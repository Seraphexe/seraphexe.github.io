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
function opisEkranu(poziom, pion, dane, odswiezanie) {
    const sztuk = poziom * pion;
    const szerPx = poziom * dane.piksele;
    const wysPx = pion * dane.piksele;

    // LAN: ile pełnych kabinetów mieści się na jednym porcie
    // Wyższe odświeżanie = mniej pikseli na port (np. 120 Hz -> połowa)
    const pikseliNaPort = PIKSELE_NA_PORT_60HZ * 60 / odswiezanie;
    const kabNaPort = Math.max(1, Math.floor(pikseliNaPort / (dane.piksele * dane.piksele)));
    const kableLan = Math.ceil(sztuk / kabNaPort);

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
        zasilanie = `${kableZas} <small>(do ${kabNaLinie} kab. na kabel 16 A, włączaj po kolei)</small>`;
        moc = `${zaokr(watow / 1000)} kW`;
        zasilaniePrzylacze = przylacze(watow);
    }

    let waga = "brak danych";
    if (dane.waga !== null) {
        waga = `${zaokr(sztuk * dane.waga)} kg <small>(same kabinety)</small>`;
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
                </dl>
            </div>
            <div class="wynik-blok">
                <h3>Na wyjazd</h3>
                <dl class="dane">
                    <dt>Kable LAN z procesora</dt><dd>${kableLan} <small>(do ${kabNaPort} kab. na port, ${poPolsku(odswiezanie)} Hz)</small></dd>
                    <dt>Kable zasilające</dt><dd>${zasilanie}</dd>
                    <dt>Moc maks.</dt><dd>${moc}</dd>
                    <dt>Przyłącze</dt><dd>${zasilaniePrzylacze}</dd>
                    <dt>Waga</dt><dd>${waga}</dd>
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
}

function zKabinetow(pole, lista) {
    const ile = Number(pole.value);
    const metry = ile * KABINET_M;
    lista.value = (Number.isInteger(ile) && ile > 0 && metry <= MAX_ROZMIAR_M) ? String(metry) : "";
    wynik.innerHTML = "";
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
    const odswiezanie = Number(document.getElementById("odswiezanie").value);
    wynik.innerHTML = opisEkranu(poziom, pion, daneKabinetu(pitch), odswiezanie);
});
