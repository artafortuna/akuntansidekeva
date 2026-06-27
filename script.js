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

function editDompet(id, name) { 
    db.transaction("dompet", "readwrite").objectStore("dompet").put({id: id, name: name}).onsuccess = loadDompet; 
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

// FUNGSI BARU UNTUK MENGHAPUS BARIS
function hapusBaris(btn, name) {
    if(confirm("Hapus baris ini?")) {
        let row = btn.closest("tr");
        row.remove(); // Menghapus elemen baris dari tabel (DOM)
        simpan(name); // Menyimpan ulang tabel ke database tanpa baris tersebut
        hitung(); // Menghitung ulang total saldo
    }
}