// Rozmiar jednego kabinetu w metrach
const KABINET_M = 0.5;
// Największy wymiar na liście wyboru (w metrach)
const MAX_ROZMIAR_M = 30;

// Zamienia tekst na liczbę; działa i z przecinkiem (4,8), i z kropką (4.8)
function liczba(tekst) {
    return Number(tekst.trim().replace(",", "."));
}

// Zapis liczby po polsku: 1.5 -> "1,5"
function poPolsku(x) {
    return String(x).replace(".", ",");
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

// Ile pikseli ma jeden kabinet 500 x 500 mm przy danym pitchu
function pikseleNaKabinet(pitch) {
    if (pitch === 1.5) return 320;
    if (pitch === 1.9) return 256;
    if (pitch === 2.6) return 192;
    if (pitch === 3.9) return 128;
    return Math.round(500 / pitch);
}

// Buduje opis wyniku
function opisEkranu(poziom, pion, piksele) {
    return `
        <h3>Wynik</h3>
        <p>
            Kabinety: ${poziom} x ${pion} (razem ${poziom * pion} szt.)<br>
            Rozmiar: ${poPolsku(poziom * KABINET_M)} x ${poPolsku(pion * KABINET_M)} m<br>
            Jeden kabinet: ${piksele} x ${piksele} px<br>
            Rozdzielczość: ${poziom * piksele} x ${pion * piksele} px
        </p>
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

// Pokaż pole "własny pitch" tylko po wybraniu kafelka "Inny…"
kafelkiPitch.forEach(function (kafelek) {
    kafelek.addEventListener("change", function () {
        const wybrany = document.querySelector('input[name="pitch"]:checked').value;
        pitchWlasnyBlok.hidden = wybrany !== "inny";
    });
});

przycisk.addEventListener("click", function () {
    // 1. Odczyt danych
    const szerokosc_m = Number(listaSzerokosc.value);
    const wysokosc_m = Number(listaWysokosc.value);

    const wybrany = document.querySelector('input[name="pitch"]:checked').value;
    let pitch;
    if (wybrany === "inny") {
        pitch = liczba(document.getElementById("pitch_wlasny").value);
    } else {
        pitch = Number(wybrany);
    }

    // 2. Sprawdzenie, czy wszystko wybrano
    if (!(szerokosc_m > 0) || !(wysokosc_m > 0) || !(pitch > 0)) {
        wynik.innerHTML = "<p>Wybierz szerokość, wysokość i pitch.</p>";
        return;
    }

    // 3. Obliczenia
    const piksele = pikseleNaKabinet(pitch);
    const poziom = Math.round(szerokosc_m / KABINET_M);
    const pion = Math.round(wysokosc_m / KABINET_M);

    wynik.innerHTML = opisEkranu(poziom, pion, piksele);
});
