// Rozmiar jednego kabinetu w metrach
const KABINET_M = 0.5;
// Największy wymiar na liście wyboru (w metrach)
const MAX_ROZMIAR_M = 30;
// Napięcie sieci (do liczenia prądu)
const NAPIECIE_V = 230;
// Ile pikseli obsługuje jeden port 1 Gb sterownika (przybliżenie)
const PIKSELE_NA_PORT = 650000;

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

// Buduje opis wyniku
function opisEkranu(poziom, pion, dane) {
    const sztuk = poziom * pion;
    const szerPx = poziom * dane.piksele;
    const wysPx = pion * dane.piksele;
    const porty = Math.ceil((szerPx * wysPx) / PIKSELE_NA_PORT);

    let waga = "brak danych";
    if (dane.waga !== null) {
        waga = `${zaokr(sztuk * dane.waga)} kg (same kabinety)`;
    }

    let moc = "brak danych";
    if (dane.moc !== null) {
        const watow = sztuk * dane.moc;
        moc = `${zaokr(watow / 1000)} kW, ok. ${Math.ceil(watow / NAPIECIE_V)} A przy 230 V`;
    }

    return `
        <h3>Wynik</h3>
        <p>
            Kabinety: ${poziom} x ${pion} (razem ${sztuk} szt.)<br>
            Rozmiar: ${poPolsku(poziom * KABINET_M)} x ${poPolsku(pion * KABINET_M)} m<br>
            Jeden kabinet: ${dane.piksele} x ${dane.piksele} px<br>
            Rozdzielczość: ${szerPx} x ${wysPx} px<br>
            Waga: ${waga}<br>
            Moc maks.: ${moc}<br>
            Porty sterownika (1 Gb): min. ${porty}
        </p>
    `;
}

const listaSzerokosc = document.getElementById("szerokosc_m");
const listaWysokosc = document.getElementById("wysokosc_m");
const trybMetry = document.getElementById("tryb_metry");
const trybKabinety = document.getElementById("tryb_kabinety");
const przycisk = document.getElementById("oblicz");
const wynik = document.getElementById("wynik");
const pitchWlasnyBlok = document.getElementById("pitch_wlasny_blok");
const kafelkiPitch = document.querySelectorAll('input[name="pitch"]');

wypelnijRozmiary(listaSzerokosc);
wypelnijRozmiary(listaWysokosc);

// Przełączanie: metry <-> ilość kabinetów
document.getElementById("na_kabinety").addEventListener("click", function () {
    trybMetry.hidden = true;
    trybKabinety.hidden = false;
    wynik.innerHTML = "";
});

document.getElementById("na_metry").addEventListener("click", function () {
    trybKabinety.hidden = true;
    trybMetry.hidden = false;
    wynik.innerHTML = "";
});

// Pokaż pole "własny pitch" tylko po wybraniu kafelka "Inny…"
kafelkiPitch.forEach(function (kafelek) {
    kafelek.addEventListener("change", function () {
        const wybrany = document.querySelector('input[name="pitch"]:checked').value;
        pitchWlasnyBlok.hidden = wybrany !== "inny";
    });
});

przycisk.addEventListener("click", function () {
    // 1. Ilość kabinetów: z metrów albo wpisana wprost
    let poziom;
    let pion;
    if (trybKabinety.hidden) {
        poziom = Math.round(Number(listaSzerokosc.value) / KABINET_M);
        pion = Math.round(Number(listaWysokosc.value) / KABINET_M);
    } else {
        poziom = Number(document.getElementById("kabinety_poziom").value);
        pion = Number(document.getElementById("kabinety_pion").value);
    }

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
    wynik.innerHTML = opisEkranu(poziom, pion, daneKabinetu(pitch));
});
