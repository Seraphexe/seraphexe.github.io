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

// Buduje opis wyniku
// Ile sztuk danego procesora potrzeba (porty, łączna liczba pikseli, szerokość i wysokość)
function ileProcesorow(proc, szerPx, wysPx, kableLan) {
    const zPortow = Math.ceil(kableLan / proc.porty);
    const zPikseli = Math.ceil((szerPx * wysPx) / proc.maxPikseli);
    const zWymiarow = Math.ceil(szerPx / proc.maxSzer) * Math.ceil(wysPx / proc.maxWys);
    return Math.max(zPortow, zPikseli, zWymiarow);
}

// Opis procesora: wybrany ręcznie albo dobrany automatycznie (najmniej sztuk)
function opisProcesora(wybor, szerPx, wysPx, kableLan) {
    const lista = Object.keys(PROCESORY).map(function (klucz) {
        const proc = PROCESORY[klucz];
        return { klucz: klucz, proc: proc, ile: ileProcesorow(proc, szerPx, wysPx, kableLan) };
    });
    let najlepszy = lista[0];
    lista.forEach(function (x) { if (x.ile < najlepszy.ile) najlepszy = x; });

    const wybrany = wybor === "auto" ? najlepszy : lista.find(function (x) { return x.klucz === wybor; });

    // Lista do zmiany procesora (domyślnie: dobór automatyczny)
    const opcje = [`<option value="auto"${wybor === "auto" ? " selected" : ""}>auto</option>`]
        .concat(lista.map(function (x) {
            return `<option value="${x.klucz}"${wybor === x.klucz ? " selected" : ""}>${x.proc.nazwa}</option>`;
        })).join("");
    const lista_html = `<select class="mini-wybor" id="procesor" aria-label="Procesor">${opcje}</select>`;

    const wszystkiePorty = wybrany.ile * wybrany.proc.porty;
    let tekst = `${wybrany.ile} × ${wybrany.proc.nazwa} ${lista_html}<br><small>zajęte porty: ${kableLan} z ${wszystkiePorty}</small>`;

    // Podpowiedź, gdy wybrany ręcznie procesor nie wystarcza, a inny tak
    if (wybor !== "auto" && najlepszy.ile < wybrany.ile) {
        tekst += `<br><small>Lepiej: ${najlepszy.ile} × ${najlepszy.proc.nazwa} (${najlepszy.proc.porty} portów)</small>`;
    }
    return tekst;
}

function opisEkranu(poziom, pion, dane, odswiezanie, wyborProcesora) {
    const sztuk = poziom * pion;
    const szerPx = poziom * dane.piksele;
    const wysPx = pion * dane.piksele;

    // LAN: ile pełnych kabinetów mieści się na jednym porcie
    // Wyższe odświeżanie = mniej pikseli na port (np. 120 Hz -> połowa)
    const pikseliNaPort = PIKSELE_NA_PORT_60HZ * 60 / odswiezanie;
    const kabNaPort = Math.max(1, Math.floor(pikseliNaPort / (dane.piksele * dane.piksele)));
    const linieLan = Math.ceil(sztuk / kabNaPort);
    // Backup: każda linia ma drugi kabel (i zajmuje drugi port)
    const kableLan = backupLan ? linieLan * 2 : linieLan;
    const opisLan = backupLan
        ? `${kableLan} ${wyborOdswiezania(odswiezanie)} <small>(${linieLan} linii × 2, do ${kabNaPort} kab. na port)</small>`
        : `${kableLan} ${wyborOdswiezania(odswiezanie)} <small>(do ${kabNaPort} kab. na port)</small>`;

    let zasilanie = "brak danych o mocy";
    let moc = "brak danych";
    let zasilaniePrzylacze = "brak danych";
    if (dane.moc !== null) {
        const watow = sztuk * dane.moc;
        // Z mocy: 16 A x 80% x 230 V = 2944 W na kabel; dla P1.9 (110 W) -> 26 kabinetów
        const zMocy = Math.floor((BEZPIECZNIK_LINII_A * OBCIAZENIE_LINII * NAPIECIE_V) / dane.moc);
        // Bierzemy mniejszą liczbę: z mocy albo limit z praktyki (rozruch)
        const kabNaLinie = Math.max(1, Math.min(zMocy, MAX_KAB_NA_LINIE));
        const kableZas = Math.ceil(sztuk / kabNaLinie);
        zasilanie = `${kableZas} <small>(do ${kabNaLinie} kab. na kabel 16 A)</small>`;
        moc = `${zaokr(watow / 1000)} kW`;
        zasilaniePrzylacze = przylacze(watow);
    }

    let waga = "brak danych";
    if (dane.waga !== null) {
        waga = `${zaokr(sztuk * dane.waga)} kg`;
    }

    return `
        <div class="wyniki">
            <div class="wynik-blok">
                <h3>Ekran</h3>
                <dl class="dane">
                    <dt>Kabinety</dt><dd>${poziom} x ${pion} (${sztuk} szt.)</dd>
                    <dt>Rozmiar</dt><dd>${poPolsku(poziom * KABINET_M)} x ${poPolsku(pion * KABINET_M)} m</dd>
                    <dt>Rozdzielczość</dt><dd>${szerPx} x ${wysPx} px</dd>
                    <dt>Jeden kabinet</dt><dd>${dane.piksele} x ${dane.piksele} px</dd>
                    <dt>Waga kabinetów</dt><dd>${waga}</dd>
                </dl>
            </div>
            <div class="wynik-blok">
                <h3>Sygnał</h3>
                <dl class="dane">
                    <dt>Kable LAN z procesora</dt><dd>${opisLan}<br><label class="mini-check"><input type="checkbox" id="backup"${backupLan ? " checked" : ""}> backup (podwójny sygnał)</label></dd>
                    <dt>Procesor</dt><dd>${opisProcesora(wyborProcesora, szerPx, wysPx, kableLan)}</dd>
                </dl>
            </div>
            <div class="wynik-blok">
                <h3>Zasilanie</h3>
                <dl class="dane">
                    <dt>Kable zasilające</dt><dd>${zasilanie}</dd>
                    <dt>Moc maks.</dt><dd>${moc}</dd>
                    <dt>Przyłącze</dt><dd>${zasilaniePrzylacze}</dd>
                </dl>
            </div>
        </div>
    `;
}

const listaSzerokosc = document.getElementById("szerokosc_m");
const listaWysokosc = document.getElementById("wysokosc_m");
const przycisk = document.getElementById("oblicz");
const wynik = document.getElementById("wynik");
const pitchWlasnyBlok = document.getElementById("pitch_wlasny_blok");
const kafelkiPitch = document.querySelectorAll('input[name="pitch"]');

wypelnijRozmiary(listaSzerokosc);
wypelnijRozmiary(listaWysokosc);

// Synchronizacja: metry <-> ilość kabinetów (zmiana jednego uzupełnia drugie)
const poleKabPoziom = document.getElementById("kabinety_poziom");
const poleKabPion = document.getElementById("kabinety_pion");

function zMetrow(lista, pole) {
    pole.value = lista.value ? Math.round(Number(lista.value) / KABINET_M) : "";
    wynik.innerHTML = "";
    ostatnie = null;
}

function zKabinetow(pole, lista) {
    const ile = Number(pole.value);
    const metry = ile * KABINET_M;
    lista.value = (Number.isInteger(ile) && ile > 0 && metry <= MAX_ROZMIAR_M) ? String(metry) : "";
    wynik.innerHTML = "";
    ostatnie = null;
}

listaSzerokosc.addEventListener("change", function () { zMetrow(listaSzerokosc, poleKabPoziom); });
listaWysokosc.addEventListener("change", function () { zMetrow(listaWysokosc, poleKabPion); });
poleKabPoziom.addEventListener("input", function () { zKabinetow(poleKabPoziom, listaSzerokosc); });
poleKabPion.addEventListener("input", function () { zKabinetow(poleKabPion, listaWysokosc); });

// Pokaż pole "własny pitch" tylko po wybraniu kafelka "Inny…"
kafelkiPitch.forEach(function (kafelek) {
    kafelek.addEventListener("change", function () {
        const wybrany = document.querySelector('input[name="pitch"]:checked').value;
        pitchWlasnyBlok.hidden = wybrany !== "inny";
    });
});

// Mały przełącznik odświeżania przy kablach LAN
const ODSWIEZANIA = [29.97, 30, 50, 60, 100, 120];
let odswiezanieHz = 60;
let procesorWybor = "auto";
let backupLan = false;

function wyborOdswiezania(aktualne) {
    const opcje = ODSWIEZANIA.map(function (hz) {
        const zaznaczone = hz === aktualne ? " selected" : "";
        return `<option value="${hz}"${zaznaczone}>${poPolsku(hz)} Hz</option>`;
    }).join("");
    return `<select class="mini-wybor" id="odswiezanie" aria-label="Odświeżanie">${opcje}</select>`;
}

// Ostatnio obliczony ekran (żeby zmiana ustawień sprzętu od razu przeliczała wynik)
let ostatnie = null;

function pokazWynik() {
    if (!ostatnie) return;
    const odswiezanie = odswiezanieHz;
    const wyborProcesora = procesorWybor;
    wynik.innerHTML = opisEkranu(ostatnie.poziom, ostatnie.pion, ostatnie.dane, odswiezanie, wyborProcesora);
}

// Przełącznik odświeżania jest w wyniku, więc nasłuchujemy zmian na całym bloku wyniku
wynik.addEventListener("change", function (e) {
    if (e.target.id === "odswiezanie") {
        odswiezanieHz = Number(e.target.value);
        pokazWynik();
    }
    if (e.target.id === "backup") {
        backupLan = e.target.checked;
        pokazWynik();
    }
    if (e.target.id === "procesor") {
        procesorWybor = e.target.value;
        pokazWynik();
    }
});

przycisk.addEventListener("click", function () {
    // 1. Ilość kabinetów (pola kabinetów są zawsze uzupełnione, także po wyborze metrów)
    const poziom = Number(poleKabPoziom.value);
    const pion = Number(poleKabPion.value);

    // 2. Pitch
    const wybrany = document.querySelector('input[name="pitch"]:checked').value;
    let pitch;
    if (wybrany === "inny") {
        pitch = liczba(document.getElementById("pitch_wlasny").value);
    } else {
        pitch = Number(wybrany);
    }

    // 3. Sprawdzenie danych
    if (!(poziom > 0) || !(pion > 0) || !Number.isInteger(poziom) || !Number.isInteger(pion)) {
        wynik.innerHTML = "<p>Podaj wymiar ekranu (albo ilość kabinetów w liczbach całkowitych).</p>";
        return;
    }
    if (!(pitch > 0)) {
        wynik.innerHTML = "<p>Wybierz albo wpisz pitch.</p>";
        return;
    }

    // 4. Wynik
    ostatnie = { poziom: poziom, pion: pion, dane: daneKabinetu(pitch) };
    pokazWynik();
});
