// Rozmiar jednego kabinetu w metrach
const KABINET_M = 0.5;
// Największy wymiar na liście wyboru (w metrach)
const MAX_ROZMIAR_M = 30;
// Napięcie sieci (do liczenia prądu)
const NAPIECIE_V = 230;
// Ile pikseli obsługuje jeden port 1 Gb procesora przy 60 Hz (NovaStar)
const PIKSELE_NA_PORT_60HZ = 655360;
// Zabezpieczenie jednej linii zasilającej z rozdzielni [A]
const BEZPIECZNIK_LINII_A = 16;
// Bezpieczne obciążenie linii: 80% bezpiecznika (praca ciągła)
const OBCIAZENIE_LINII = 0.8;
// Limit z praktyki: prąd rozruchowy przy włączaniu (16 kabinetów P1.9 wybiło bezpiecznik)
const MAX_KAB_NA_LINIE = 15;

// Procesory (wg kart producenta)
const PROCESORY = {
    "vx1000pro": { nazwa: "VX1000 Pro", porty: 10, maxPikseli: 6500000, maxSzer: 10240, maxWys: 8192 },
    "mctrl4k": { nazwa: "MCTRL4K", porty: 16, maxPikseli: 3840 * 2160, maxSzer: 3840, maxWys: 2160 },
};

// Dane kabinetów 500 x 500 mm dla znanych pitchy.
// waga [kg] i moc [W] na jeden kabinet; null = brak danych
const KABINETY = {
    "1.5": { piksele: 320, waga: null, moc: null },
    "1.9": { piksele: 256, waga: 7.25, moc: 110 }, // z tabliczki: 440 W/m², 7,25 kg
    "2.6": { piksele: 192, waga: null, moc: null },
    "3.9": { piksele: 128, waga: null, moc: null },
};

// Zamienia tekst na liczbę; działa i z przecinkiem (4,8), i z kropką (4.8)
function liczba(tekst) {
    return Number(tekst.trim().replace(",", "."));
}

// Zapis liczby po polsku: 1.5 -> "1,5"
function poPolsku(x) {
    return String(x).replace(".", ",");
}

// Zaokrągla do 1 miejsca po przecinku i zapisuje po polsku
function zaokr(x) {
    return poPolsku(Math.round(x * 10) / 10);
}

// Wypełnia listę rozwijaną rozmiarami: 0,5 m, 1 m, 1,5 m ... MAX_ROZMIAR_M
function wypelnijRozmiary(lista) {
    for (let m = KABINET_M; m <= MAX_ROZMIAR_M; m += KABINET_M) {
        const opcja = document.createElement("option");
        opcja.value = m;
        opcja.textContent = poPolsku(m) + " m";
        lista.appendChild(opcja);
    }
}

// Dane kabinetu dla wybranego pitchu (dla nieznanych: piksele z wzoru, reszta brak)
function daneKabinetu(pitch) {
    const znany = KABINETY[String(pitch)];
    if (znany) return znany;
    return { piksele: Math.round(500 / pitch), waga: null, moc: null };
}

// Podpowiedź, jakie przyłącze trójfazowe wystarczy
function przylacze(watow) {
    const naFaze = watow / 3 / NAPIECIE_V;
    if (naFaze <= 32) return `32 A (3 fazy), ok. ${Math.ceil(naFaze)} A na fazę`;
    if (naFaze <= 63) return `63 A (3 fazy), ok. ${Math.ceil(naFaze)} A na fazę`;
    return `ponad 63 A! ok. ${Math.ceil(naFaze)} A na fazę`;
}

// ===== Procesory =====

// Ile sztuk procesora potrzeba. x = { porty, pikseli, uklady: [[szer, wys], ...] }
// "uklady" to możliwe ułożenia obrazu (np. ścianki jedna pod drugą albo obok siebie) — bierzemy najlepsze
function ileProcesorow(proc, x) {
    const zPortow = Math.ceil(x.porty / proc.porty);
    const zPikseli = Math.ceil(x.pikseli / proc.maxPikseli);
    const zWymiarow = Math.min.apply(null, x.uklady.map(function (u) {
        return Math.ceil(u[0] / proc.maxSzer) * Math.ceil(u[1] / proc.maxWys);
    }));
    return Math.max(zPortow, zPikseli, zWymiarow);
}

// Opis procesora: wybrany ręcznie albo dobrany automatycznie (najmniej sztuk)
// idListy = id małej listy wyboru (null = bez listy, zawsze auto)
function opisProcesora(wybor, x, idListy) {
    const lista = Object.keys(PROCESORY).map(function (klucz) {
        return { klucz: klucz, proc: PROCESORY[klucz], ile: ileProcesorow(PROCESORY[klucz], x) };
    });
    let najlepszy = lista[0];
    lista.forEach(function (p) { if (p.ile < najlepszy.ile) najlepszy = p; });

    const wybrany = wybor === "auto" ? najlepszy : lista.find(function (p) { return p.klucz === wybor; });

    let listaHtml = "";
    if (idListy) {
        const opcje = [`<option value="auto"${wybor === "auto" ? " selected" : ""}>auto</option>`]
            .concat(lista.map(function (p) {
                return `<option value="${p.klucz}"${wybor === p.klucz ? " selected" : ""}>${p.proc.nazwa}</option>`;
            })).join("");
        listaHtml = ` <select class="mini-wybor" id="${idListy}" aria-label="Procesor">${opcje}</select>`;
    }

    let tekst = `${wybrany.ile} × ${wybrany.proc.nazwa}${listaHtml}<br><small>zajęte porty: ${x.porty} z ${wybrany.ile * wybrany.proc.porty}</small>`;
    if (wybor !== "auto" && najlepszy.ile < wybrany.ile) {
        tekst += `<br><small>Lepiej: ${najlepszy.ile} × ${najlepszy.proc.nazwa} (${najlepszy.proc.porty} portów)</small>`;
    }
    return tekst;
}

// ===== Ścianki =====

const ODSWIEZANIA = [29.97, 30, 50, 60, 100, 120];

let sciany = [];
let aktywna = 0;

function nowaSciana(wzor) {
    return {
        nazwa: `Ścianka ${sciany.length + 1}`,
        poziom: "",
        pion: "",
        pitch: wzor ? wzor.pitch : "1.9",
        pitchWlasny: wzor ? wzor.pitchWlasny : "",
        hz: wzor ? wzor.hz : 60,
        backup: false,
        procesor: "auto",
        grupaProc: wzor ? wzor.grupaProc : "1",   // procesor 1, 2, 3...
        grupaZas: wzor ? wzor.grupaZas : "A",     // zasilanie A, B, C...
        polaczona: null,    // numer ścianki, z którą tworzy jeden obraz (tylko wcześniejsze ścianki)
        strona: "prawo",    // z której strony tamtej ścianki stoi
        obliczona: false,
    };
}

function pitchSciany(w) {
    return w.pitch === "inny" ? liczba(w.pitchWlasny) : Number(w.pitch);
}

// Wszystkie obliczenia dla jednej ścianki (same liczby, bez HTML)
function obliczSciane(w) {
    const poziom = Number(w.poziom);
    const pion = Number(w.pion);
    const pitch = pitchSciany(w);
    if (!(poziom > 0) || !(pion > 0) || !Number.isInteger(poziom) || !Number.isInteger(pion)) {
        return { blad: "Podaj wymiar ekranu (albo ilość kabinetów w liczbach całkowitych)." };
    }
    if (!(pitch > 0)) return { blad: "Wybierz albo wpisz pitch." };

    const dane = daneKabinetu(pitch);
    const sztuk = poziom * pion;
    const szerPx = poziom * dane.piksele;
    const wysPx = pion * dane.piksele;

    // LAN: wyższe odświeżanie = mniej pikseli na port; backup = drugi kabel na każdą linię
    const pikseliNaPort = PIKSELE_NA_PORT_60HZ * 60 / w.hz;
    const kabNaPort = Math.max(1, Math.floor(pikseliNaPort / (dane.piksele * dane.piksele)));
    const linieLan = Math.ceil(sztuk / kabNaPort);
    const kableLan = w.backup ? linieLan * 2 : linieLan;

    // Zasilanie: mniejsza liczba z mocy (16 A × 80%) albo z praktyki (rozruch)
    let watow = null, kableZas = null, kabNaLinie = null;
    if (dane.moc !== null) {
        watow = sztuk * dane.moc;
        const zMocy = Math.floor((BEZPIECZNIK_LINII_A * OBCIAZENIE_LINII * NAPIECIE_V) / dane.moc);
        kabNaLinie = Math.max(1, Math.min(zMocy, MAX_KAB_NA_LINIE));
        kableZas = Math.ceil(sztuk / kabNaLinie);
    }
    const waga = dane.waga !== null ? sztuk * dane.waga : null;

    return { poziom, pion, sztuk, dane, szerPx, wysPx, kabNaPort, linieLan, kableLan, watow, kableZas, kabNaLinie, waga };
}

function wyborOdswiezania(aktualne) {
    const opcje = ODSWIEZANIA.map(function (hz) {
        return `<option value="${hz}"${hz === aktualne ? " selected" : ""}>${poPolsku(hz)} Hz</option>`;
    }).join("");
    return `<select class="mini-wybor" id="odswiezanie" aria-label="Odświeżanie">${opcje}</select>`;
}

function zaznaczenie(id, opis, wlaczone) {
    return `<label class="mini-check"><input type="checkbox" id="${id}"${wlaczone ? " checked" : ""}> ${opis}</label>`;
}

// Wyniki aktywnej ścianki
function htmlSciany(w) {
    const r = obliczSciane(w);
    if (r.blad) return `<p>${r.blad}</p>`;

    const opisLan = w.backup
        ? `${r.kableLan} ${wyborOdswiezania(w.hz)} <small>(${r.linieLan} linii × 2, do ${r.kabNaPort} kab. na port)</small>`
        : `${r.kableLan} ${wyborOdswiezania(w.hz)} <small>(do ${r.kabNaPort} kab. na port)</small>`;
    const proc = opisProcesora(w.procesor, { porty: r.kableLan, pikseli: r.szerPx * r.wysPx, uklady: [[r.szerPx, r.wysPx]] }, "procesor");

    const zasilanie = r.kableZas !== null ? `${r.kableZas} <small>(do ${r.kabNaLinie} kab. na kabel 16 A)</small>` : "brak danych o mocy";
    const moc = r.watow !== null ? `${zaokr(r.watow / 1000)} kW` : "brak danych";
    const przyl = r.watow !== null ? przylacze(r.watow) : "brak danych";
    const waga = r.waga !== null ? `${zaokr(r.waga)} kg` : "brak danych";


    return `
        <div class="wyniki">
            <div class="wynik-blok">
                <h3>Ekran</h3>
                <dl class="dane">
                    <dt>Kabinety</dt><dd>${r.poziom} x ${r.pion} (${r.sztuk} szt.)</dd>
                    <dt>Rozmiar</dt><dd>${poPolsku(r.poziom * KABINET_M)} x ${poPolsku(r.pion * KABINET_M)} m</dd>
                    <dt>Rozdzielczość</dt><dd>${r.szerPx} x ${r.wysPx} px</dd>
                    <dt>Jeden kabinet</dt><dd>${r.dane.piksele} x ${r.dane.piksele} px</dd>
                    <dt>Waga kabinetów</dt><dd>${waga}</dd>
                </dl>
            </div>
            <div class="wynik-blok">
                <h3>Sygnał</h3>
                <dl class="dane">
                    <dt>Kable LAN z procesora</dt><dd>${opisLan}<br>${zaznaczenie("backup", "backup (podwójny sygnał)", w.backup)}</dd>
                    <dt>Procesor</dt><dd>${proc}</dd>
                </dl>
            </div>
            <div class="wynik-blok">
                <h3>Zasilanie</h3>
                <dl class="dane">
                    <dt>Kable zasilające</dt><dd>${zasilanie}</dd>
                    <dt>Moc maks.</dt><dd>${moc}</dd>
                    <dt>Przyłącze</dt><dd>${przyl}</dd>
                </dl>
            </div>
        </div>
    `;
}

// ===== Wspólne obrazy (połączone ścianki) =====

const STRONY = { prawo: "z prawej", lewo: "z lewej", nad: "nad", pod: "pod" };

// Układa połączone ścianki na wspólnym obrazie i liczy jego rozdzielczość.
// Zwraca listę obrazów: { sciany: [...], szer, wys, puste, roznePitche }
function obrazy(gotowe) {
    const poz = {}; // numer ścianki -> { x, y, obraz }
    const lista = [];
    gotowe.forEach(function (g) {
        const nr = sciany.indexOf(g.w);
        const cel = g.w.polaczona;
        if (cel !== null && poz[cel]) {
            const t = poz[cel];
            let x = t.x, y = t.y;
            if (g.w.strona === "prawo") x = t.x + t.szer;
            if (g.w.strona === "lewo") x = t.x - g.r.szerPx;
            if (g.w.strona === "nad") y = t.y - g.r.wysPx;
            if (g.w.strona === "pod") y = t.y + t.wys;
            poz[nr] = { x: x, y: y, szer: g.r.szerPx, wys: g.r.wysPx, obraz: t.obraz };
            t.obraz.elementy.push({ g: g, x: x, y: y });
        } else {
            const obraz = { elementy: [{ g: g, x: 0, y: 0 }] };
            lista.push(obraz);
            poz[nr] = { x: 0, y: 0, szer: g.r.szerPx, wys: g.r.wysPx, obraz: obraz };
        }
    });
    return lista.map(function (o) {
        const minX = Math.min.apply(null, o.elementy.map(function (e) { return e.x; }));
        const minY = Math.min.apply(null, o.elementy.map(function (e) { return e.y; }));
        const maxX = Math.max.apply(null, o.elementy.map(function (e) { return e.x + e.g.r.szerPx; }));
        const maxY = Math.max.apply(null, o.elementy.map(function (e) { return e.y + e.g.r.wysPx; }));
        const szer = maxX - minX, wys = maxY - minY;
        const pole = o.elementy.reduce(function (s, e) { return s + e.g.r.szerPx * e.g.r.wysPx; }, 0);
        const pitche = new Set(o.elementy.map(function (e) { return e.g.r.dane.piksele; }));
        return { sciany: o.elementy.map(function (e) { return e.g.w.nazwa; }), szer: szer, wys: wys, puste: pole < szer * wys, roznePitche: pitche.size > 1 };
    });
}

// ===== Podsumowanie wszystkich obliczonych ścianek =====

const GRUPY_PROC = ["1", "2", "3", "4"];
const GRUPY_ZAS = ["A", "B", "C", "D"];

function listaGrupy(klasa, nr, wartosc, opcje, przedrostek) {
    const o = opcje.map(function (g) {
        return `<option value="${g}"${g === wartosc ? " selected" : ""}>${przedrostek}${g}</option>`;
    }).join("");
    return `<select class="mini-wybor ${klasa}" data-nr="${nr}">${o}</select>`;
}

function htmlPodsumowania() {
    const gotowe = sciany
        .map(function (w) { return { w: w, r: w.obliczona ? obliczSciane(w) : null }; })
        .filter(function (x) { return x.r && !x.r.blad; });
    if (sciany.length < 2 || gotowe.length < 2) return "";

    const wiersze = gotowe.map(function (x) {
        const nr = sciany.indexOf(x.w);
        const lan = x.w.backup ? `${x.r.kableLan} <small>(${x.r.linieLan} + ${x.r.linieLan} backup)</small>` : `${x.r.kableLan}`;
        return `<tr><td>${x.w.nazwa}</td><td>${x.r.poziom} × ${x.r.pion}</td><td>${x.r.szerPx} × ${x.r.wysPx}</td><td>${lan}</td>`
            + `<td class="srodek"><input type="checkbox" class="backup-wiersz" data-nr="${nr}" aria-label="backup ${x.w.nazwa}"${x.w.backup ? " checked" : ""}></td>`
            + `<td>${listaGrupy("proc-wiersz", nr, x.w.grupaProc, GRUPY_PROC, "Procesor ")}</td>`
            + `<td>${listaGrupy("zas-wiersz", nr, x.w.grupaZas, GRUPY_ZAS, "Zasilanie ")}</td>`
            + `<td>${x.r.waga !== null ? zaokr(x.r.waga) + " kg" : "–"}</td></tr>`;
    }).join("");

    // Wspólne obrazy (połączone ścianki)
    const obr = obrazy(gotowe).filter(function (o) { return o.sciany.length > 1; });
    const blokObrazy = obr.length ? `
        <div class="wyniki">${obr.map(function (o, i) {
            return `<div class="wynik-blok"><h3>Obraz ${i + 1}</h3><dl class="dane">
                <dt>Ścianki</dt><dd>${o.sciany.join(" + ")}</dd>
                <dt>Rozdzielczość całości</dt><dd>${o.szer} x ${o.wys} px</dd>
            </dl>
            ${o.puste ? "<p><small>Obraz ma puste pola (ścianki nie wypełniają prostokąta).</small></p>" : ""}
            ${o.roznePitche ? "<p><small>Uwaga: różne pitche w jednym obrazie.</small></p>" : ""}</div>`;
        }).join("")}</div>` : "";

    // Grupy procesorów
    const blokiProc = GRUPY_PROC.map(function (gr) {
        const g = gotowe.filter(function (x) { return x.w.grupaProc === gr; });
        if (!g.length) return "";
        const porty = g.reduce(function (s, x) { return s + x.r.kableLan; }, 0);
        const zBackupem = g.reduce(function (s, x) { return s + (x.w.backup ? x.r.linieLan : 0); }, 0);
        const pikseli = g.reduce(function (s, x) { return s + x.r.szerPx * x.r.wysPx; }, 0);
        // Rozmiar obrazu na procesorze: połączone ścianki jako jeden obraz, reszta ułożona obok / pod sobą
        const o = obrazy(g);
        const uklady = [
            [Math.max.apply(null, o.map(function (q) { return q.szer; })), o.reduce(function (s, q) { return s + q.wys; }, 0)],
            [o.reduce(function (s, q) { return s + q.szer; }, 0), Math.max.apply(null, o.map(function (q) { return q.wys; }))],
        ];
        return `<div class="wynik-blok"><h3>Procesor ${gr}</h3><dl class="dane">
            <dt>Ścianki</dt><dd>${g.map(function (x) { return x.w.nazwa; }).join(", ")}</dd>
            <dt>Kable LAN z procesora</dt><dd>${porty}${zBackupem ? ` <small>(w tym backup: ${zBackupem})</small>` : ""}</dd>
            <dt>Procesor</dt><dd>${opisProcesora("auto", { porty: porty, pikseli: pikseli, uklady: uklady }, null)}</dd>
        </dl></div>`;
    }).join("");

    // Grupy zasilania
    const blokiZas = GRUPY_ZAS.map(function (gr) {
        const g = gotowe.filter(function (x) { return x.w.grupaZas === gr; });
        if (!g.length) return "";
        const zDanymi = g.filter(function (x) { return x.r.watow !== null; });
        const bezDanych = g.filter(function (x) { return x.r.watow === null; });
        const kable = zDanymi.reduce(function (s, x) { return s + x.r.kableZas; }, 0);
        const watow = zDanymi.reduce(function (s, x) { return s + x.r.watow; }, 0);
        return `<div class="wynik-blok"><h3>Zasilanie ${gr}</h3><dl class="dane">
            <dt>Ścianki</dt><dd>${g.map(function (x) { return x.w.nazwa; }).join(", ")}</dd>
            <dt>Kable zasilające</dt><dd>${zDanymi.length ? kable : "brak danych"}</dd>
            <dt>Moc maks.</dt><dd>${zDanymi.length ? zaokr(watow / 1000) + " kW" : "brak danych"}</dd>
            <dt>Przyłącze</dt><dd>${zDanymi.length ? przylacze(watow) : "brak danych"}</dd>
        </dl>
        ${bezDanych.length ? `<p><small>Bez danych o mocy: ${bezDanych.map(function (b) { return b.w.nazwa; }).join(", ")}</small></p>` : ""}</div>`;
    }).join("");

    return `
        <h2 class="podsumowanie-tytul">Podsumowanie</h2>
        <div class="tabela-wrap">
            <table class="tabela">
                <thead><tr><th>Ścianka</th><th>Kabinety</th><th>Rozdzielczość</th><th>Kable LAN</th><th class="srodek">Backup</th><th>Procesor</th><th>Zasilanie</th><th>Waga</th></tr></thead>
                <tbody>${wiersze}</tbody>
            </table>
        </div>
        ${blokObrazy}
        <div class="wyniki">${blokiProc}${blokiZas}</div>
    `;
}

// ===== Formularz i widok =====

const listaSzerokosc = document.getElementById("szerokosc_m");
const listaWysokosc = document.getElementById("wysokosc_m");
const poleKabPoziom = document.getElementById("kabinety_poziom");
const poleKabPion = document.getElementById("kabinety_pion");
const polePitchWlasny = document.getElementById("pitch_wlasny");
const poleNazwa = document.getElementById("nazwa_sciany");
const pitchWlasnyBlok = document.getElementById("pitch_wlasny_blok");
const kafelkiPitch = document.querySelectorAll('input[name="pitch"]');
const zakladki = document.getElementById("zakladki");
const przycisk = document.getElementById("oblicz");
const przyciskUsun = document.getElementById("usun_sciane");
const wynik = document.getElementById("wynik");
const podsumowanie = document.getElementById("podsumowanie");
const blokPolaczenia = document.getElementById("polaczenie_blok");
const listaPolaczona = document.getElementById("polaczona");
const listaStrona = document.getElementById("strona");

wypelnijRozmiary(listaSzerokosc);
wypelnijRozmiary(listaWysokosc);

function metryZKabinetow(ile) {
    const metry = ile * KABINET_M;
    return (Number.isInteger(ile) && ile > 0 && metry <= MAX_ROZMIAR_M) ? String(metry) : "";
}

// Wpisuje dane ścianki do formularza
function wczytajFormularz(w) {
    poleNazwa.value = w.nazwa;
    poleKabPoziom.value = w.poziom;
    poleKabPion.value = w.pion;
    listaSzerokosc.value = metryZKabinetow(Number(w.poziom));
    listaWysokosc.value = metryZKabinetow(Number(w.pion));
    kafelkiPitch.forEach(function (k) { k.checked = k.value === w.pitch; });
    polePitchWlasny.value = w.pitchWlasny;
    pitchWlasnyBlok.hidden = w.pitch !== "inny";
    pokazPolaczenie(w);
}

// Lista "połączona z": tylko wcześniejsze ścianki (dzięki temu nie da się zrobić pętli)
function pokazPolaczenie(w) {
    const nr = sciany.indexOf(w);
    blokPolaczenia.hidden = nr < 1;
    if (nr < 1) return;
    const opcje = ['<option value="">— osobny obraz —</option>'].concat(sciany.slice(0, nr).map(function (s2, i) {
        return `<option value="${i}"${w.polaczona === i ? " selected" : ""}>${s2.nazwa}</option>`;
    })).join("");
    listaPolaczona.innerHTML = opcje;
    listaStrona.value = w.strona;
    listaStrona.disabled = w.polaczona === null;
}

// Odczytuje formularz do aktywnej ścianki
function zapiszFormularz() {
    const w = sciany[aktywna];
    w.nazwa = poleNazwa.value.trim() || `Ścianka ${aktywna + 1}`;
    w.poziom = poleKabPoziom.value;
    w.pion = poleKabPion.value;
    w.pitch = document.querySelector('input[name="pitch"]:checked').value;
    w.pitchWlasny = polePitchWlasny.value;
    pitchWlasnyBlok.hidden = w.pitch !== "inny";
    if (aktywna > 0) {
        w.polaczona = listaPolaczona.value === "" ? null : Number(listaPolaczona.value);
        w.strona = listaStrona.value;
        listaStrona.disabled = w.polaczona === null;
    }
}

function pokazZakladki() {
    const przyciski = sciany.map(function (w, i) {
        return `<button type="button" class="zakladka${i === aktywna ? " aktywna" : ""}" data-nr="${i}">${w.nazwa}</button>`;
    }).join("");
    zakladki.innerHTML = przyciski + `<button type="button" class="zakladka dodaj" id="dodaj_sciane">+ dodaj ściankę</button>`;
    przyciskUsun.hidden = sciany.length < 2;
}

function pokazWszystko() {
    pokazZakladki();
    const w = sciany[aktywna];
    wynik.innerHTML = w.obliczona ? htmlSciany(w) : "";
    podsumowanie.innerHTML = htmlPodsumowania();
}

// Zmiana w formularzu -> zapis i (jeśli już liczona) od razu nowy wynik
function poZmianie() {
    zapiszFormularz();
    pokazWszystko();
}

listaSzerokosc.addEventListener("change", function () {
    poleKabPoziom.value = listaSzerokosc.value ? Math.round(Number(listaSzerokosc.value) / KABINET_M) : "";
    poZmianie();
});
listaWysokosc.addEventListener("change", function () {
    poleKabPion.value = listaWysokosc.value ? Math.round(Number(listaWysokosc.value) / KABINET_M) : "";
    poZmianie();
});
poleKabPoziom.addEventListener("input", function () {
    listaSzerokosc.value = metryZKabinetow(Number(poleKabPoziom.value));
    poZmianie();
});
poleKabPion.addEventListener("input", function () {
    listaWysokosc.value = metryZKabinetow(Number(poleKabPion.value));
    poZmianie();
});
kafelkiPitch.forEach(function (k) { k.addEventListener("change", poZmianie); });
polePitchWlasny.addEventListener("input", poZmianie);
poleNazwa.addEventListener("input", poZmianie);
listaPolaczona.addEventListener("change", poZmianie);
listaStrona.addEventListener("change", poZmianie);

przycisk.addEventListener("click", function () {
    zapiszFormularz();
    sciany[aktywna].obliczona = true;
    pokazWszystko();
});

// Zakładki: przełączanie i dodawanie ścianek
zakladki.addEventListener("click", function (e) {
    const cel = e.target.closest("button");
    if (!cel) return;
    zapiszFormularz();
    if (cel.id === "dodaj_sciane") {
        sciany.push(nowaSciana(sciany[aktywna]));
        aktywna = sciany.length - 1;
    } else {
        aktywna = Number(cel.dataset.nr);
    }
    wczytajFormularz(sciany[aktywna]);
    pokazWszystko();
});

przyciskUsun.addEventListener("click", function () {
    if (sciany.length < 2) return;
    const usuwana = aktywna;
    sciany.splice(usuwana, 1);
    sciany.forEach(function (w, i) {
        if (w.polaczona === usuwana) w.polaczona = null;
        else if (w.polaczona !== null && w.polaczona > usuwana) w.polaczona -= 1;
        if (i === 0) w.polaczona = null;
    });
    aktywna = Math.max(0, aktywna - 1);
    wczytajFormularz(sciany[aktywna]);
    pokazWszystko();
});

// Małe przełączniki w wynikach (odświeżanie, backup, procesor, wspólne)
wynik.addEventListener("change", function (e) {
    const w = sciany[aktywna];
    const id = e.target.id;
    if (id === "odswiezanie") w.hz = Number(e.target.value);
    if (id === "backup") w.backup = e.target.checked;
    if (id === "procesor") w.procesor = e.target.value;
    pokazWszystko();
});

// Backup, wspólny procesor i wspólne zasilanie przełączane prosto z tabeli w podsumowaniu
podsumowanie.addEventListener("change", function (e) {
    const w = sciany[Number(e.target.dataset.nr)];
    if (!w) return;
    if (e.target.classList.contains("backup-wiersz")) w.backup = e.target.checked;
    if (e.target.classList.contains("proc-wiersz")) w.grupaProc = e.target.value;
    if (e.target.classList.contains("zas-wiersz")) w.grupaZas = e.target.value;
    pokazWszystko();
});

// Start: jedna ścianka
sciany.push(nowaSciana(null));
wczytajFormularz(sciany[0]);
pokazWszystko();
