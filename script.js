let db;
let currentWallet = "";

// MEMPERTAHANKAN DB LAMA: Nama "EvaDB" dan versi 13 wajib dipertahankan
let req = indexedDB.open("EvaDB", 13);

req.onupgradeneeded = e => {
    let db = e.target.result;
    if(!db.objectStoreNames.contains("dompet")) {
        db.createObjectStore("dompet", {keyPath: "id", autoIncrement: true});
    }
    if(!db.objectStoreNames.contains("dataTabel")) {
        db.createObjectStore("dataTabel", {keyPath: "id"});
    }
};

req.onsuccess = e => { 
    db = e.target.result; 
    loadDompet(); 
};

function toggleTheme() { 
    document.body.classList.toggle("dark"); 
}

function tambahDompet() {
    let n = document.getElementById("wName").value;
    if(!n) return;
    db.transaction("dompet", "readwrite").objectStore("dompet").add({name: n}).onsuccess = () => {
        document.getElementById("wName").value = ""; 
        loadDompet();
    };
}

function loadDompet() {
    let list = document.getElementById("listDompet");
    list.innerHTML = "";
    let totalGlobal = 0;
    
    db.transaction("dompet").objectStore("dompet").getAll().onsuccess = e => {
        let dompetList = e.target.result;
        db.transaction("dataTabel").objectStore("dataTabel").getAll().onsuccess = e2 => {
            let dataTabel = e2.target.result;
            dompetList.forEach(w => {
                let data = dataTabel.find(d => d.id === w.name);
                let saldo = 0;
                if(data && data.rows) {
                    data.rows.forEach(r => {
                        let deb = parseFloat((r.deb || "0").replace(/\./g, "")) || 0;
                        let kre = parseFloat((r.kre || "0").replace(/\./g, "")) || 0;
                        saldo += (deb - kre);
                    });
                }
                totalGlobal += saldo;
                list.innerHTML += `
                    <div class="card">
                        <div>
                            <div contenteditable="true" onblur="editDompet(${w.id}, this.innerText)" style="font-weight:bold">${w.name}</div>
                            <small>Saldo: Rp ${saldo.toLocaleString("id-ID")}</small>
                        </div>
                        <div>
                            <button onclick="buka('${w.name}')">Buka</button>
                            <button style="background:#FF4D4D" onclick="konfirmasiHapus(${w.id})">X</button>
                        </div>
                    </div>`;
            });
            document.getElementById("totalGlobal").innerText = "Total Aset: Rp " + totalGlobal.toLocaleString("id-ID");
        };
    };
}

function konfirmasiHapus(id) { 
    if (confirm("Yakin hapus?")) {
        db.transaction("dompet", "readwrite").objectStore("dompet").delete(id).onsuccess = loadDompet; 
    }
}

// PERBAIKAN: Fungsi Edit Dompet agar data di dalamnya tidak reset
function editDompet(id, newName) { 
    newName = newName.trim();
    if(!newName) {
        loadDompet(); // Kembalikan ke nama awal jika input kosong
        return;
    }

    // Buka transaksi ke dua penyimpanan sekaligus
    let tx = db.transaction(["dompet", "dataTabel"], "readwrite");
    let dompetStore = tx.objectStore("dompet");
    let dataStore = tx.objectStore("dataTabel");

    // Ambil data dompet yang lama
    dompetStore.get(id).onsuccess = e => {
        let oldWallet = e.target.result;
        
        // Jika tidak ada perubahan nama, hentikan proses
        if (!oldWallet || oldWallet.name === newName) return;

        let oldName = oldWallet.name;

        // 1. Simpan nama baru di daftar dompet
        oldWallet.name = newName;
        dompetStore.put(oldWallet);

        // 2. Pindahkan isi data tabel dari nama lama ke nama baru
        dataStore.get(oldName).onsuccess = e2 => {
            let tabelData = e2.target.result;
            if (tabelData) {
                tabelData.id = newName;         // Ubah kuncinya ke nama baru
                dataStore.put(tabelData);       // Simpan data dengan nama baru
                dataStore.delete(oldName);      // Hapus data dengan nama lama
            }
        };
    };

    // Refresh tampilan setelah semua transaksi selesai
    tx.oncomplete = () => loadDompet();
}

function buka(name) {
    currentWallet = name;
    document.getElementById("homePage").style.display = "none";
    document.getElementById("detailPage").style.display = "block";
    document.getElementById("judul").innerText = name;
    renderTabel();
}

function renderTabel() {
    let body = document.getElementById("tabelBody");
    body.innerHTML = "";
    db.transaction("dataTabel").objectStore("dataTabel").get(currentWallet).onsuccess = e => {
        let savedRows = e.target.result ? e.target.result.rows : [];
        savedRows.forEach((r, i) => {
            body.innerHTML += `<tr>
                <td class="col-tgl"><input type="date" value="${r.tgl || ''}" onchange="simpan('${currentWallet}')"></td>
                <td contenteditable="true" onblur="simpan('${currentWallet}')">${r.ket || ''}</td>
                <td contenteditable="true" onblur="simpan('${currentWallet}'); formatUang(this)" onfocus="bersihkan(this)">${r.deb || ''}</td>
                <td contenteditable="true" onblur="simpan('${currentWallet}'); formatUang(this)" onfocus="bersihkan(this)">${r.kre || ''}</td>
                <td class="s">0</td>
                <td><button style="background:#FF4D4D; padding:5px 10px; font-size:0.9rem;" onclick="hapusBaris(this, '${currentWallet}')">X</button></td>
            </tr>`;
        });
        hitung();
    };
}

function tambahBaris() {
    let body = document.getElementById("tabelBody");
    for(let i=0; i<10; i++) {
        body.innerHTML += `<tr>
            <td class="col-tgl"><input type="date" onchange="simpan('${currentWallet}')"></td>
            <td contenteditable="true" onblur="simpan('${currentWallet}')"></td>
            <td contenteditable="true" onblur="simpan('${currentWallet}'); formatUang(this)" onfocus="bersihkan(this)"></td>
            <td contenteditable="true" onblur="simpan('${currentWallet}'); formatUang(this)" onfocus="bersihkan(this)"></td>
            <td class="s">0</td>
            <td><button style="background:#FF4D4D; padding:5px 10px; font-size:0.9rem;" onclick="hapusBaris(this, '${currentWallet}')">X</button></td>
        </tr>`;
    }
}

function bersihkan(el) { 
    el.innerText = el.innerText.replace(/\./g, ""); 
}

function formatUang(el) { 
    let val = el.innerText.replace(/\D/g, ""); 
    el.innerText = val ? parseInt(val).toLocaleString("id-ID") : ""; 
    hitung(); 
}

function simpan(name) {
    let rows = [];
    document.querySelectorAll("#tabelBody tr").forEach(tr => {
        let tglValue = tr.cells[0].querySelector('input').value; 
        rows.push({ 
            tgl: tglValue, 
            ket: tr.cells[1].innerText, 
            deb: tr.cells[2].innerText, 
            kre: tr.cells[3].innerText 
        });
    });
    db.transaction("dataTabel", "readwrite").objectStore("dataTabel").put({id: name, rows: rows});
}

function hitung() {
    let s = 0;
    document.querySelectorAll("#tabelBody tr").forEach(r => {
        let d = parseFloat(r.cells[2].innerText.replace(/\./g, "")) || 0;
        let k = parseFloat(r.cells[3].innerText.replace(/\./g, "")) || 0;
        s += (d - k);
        r.cells[4].innerText = (d==0 && k==0) ? 0 : s.toLocaleString("id-ID");
    });
}

function showHome() { 
    document.getElementById("homePage").style.display = "block"; 
    document.getElementById("detailPage").style.display = "none"; 
    loadDompet(); 
}

function hapusBaris(btn, name) {
    if(confirm("Hapus baris ini?")) {
        let row = btn.closest("tr");
        row.remove(); 
        simpan(name); 
        hitung(); 
    }
}
