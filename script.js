// Rozmiar jednego kabinetu w metrach
const KABINET_M = 0.5;

// Ile pikseli ma jeden kabinet przy danym pitchu (jak w wersji z Pythona)
function pikseleNaKabinet(pitch) {
    if (pitch === 1.9) return 256;
    if (pitch === 2.5) return 200;
    if (pitch === 2.6) return 192;
    if (pitch === 2.9) return 168;
    return Math.round(500 / pitch);
}

// Buduje opis jednego wariantu ekranu (jak print-y w Pythonie)
function opisEkranu(tytul, poziom, pion, piksele) {
    return `
        <h3>${tytul}</h3>
        <p>
            Kabinety: ${poziom} x ${pion} (razem ${poziom * pion} szt.)<br>
            Faktyczny rozmiar: ${poziom * KABINET_M} x ${pion * KABINET_M} m<br>
            Jeden kabinet: ${piksele} x ${piksele} px<br>
            Rozdzielczość: ${poziom * piksele} x ${pion * piksele} px
        </p>
    `;
}

const przycisk = document.getElementById("oblicz");
const wynik = document.getElementById("wynik");

przycisk.addEventListener("click", function () {
    // 1. Odczyt danych z pól
    const szerokosc_m = Number(document.getElementById("szerokosc_m").value);
    const wysokosc_m = Number(document.getElementById("wysokosc_m").value);
    const pitch = Number(document.getElementById("pitch").value);

    // 2. Sprawdzenie, czy wszystko wpisano
    if (!(szerokosc_m > 0) || !(wysokosc_m > 0) || !(pitch > 0)) {
        wynik.innerHTML = "<p>Wpisz wszystkie wartości (większe od zera).</p>";
        return;
    }

    const piksele = pikseleNaKabinet(pitch);

    // 3. Kabinety: w dół (mniejszy ekran) i w górę (większy ekran)
    const poziomMniej = Math.floor(szerokosc_m / KABINET_M);
    const pionMniej = Math.floor(wysokosc_m / KABINET_M);
    const poziomWiecej = Math.ceil(szerokosc_m / KABINET_M);
    const pionWiecej = Math.ceil(wysokosc_m / KABINET_M);

    // 4. Wymiar pasuje idealnie -> jeden wynik
    if (poziomMniej === poziomWiecej && pionMniej === pionWiecej) {
        wynik.innerHTML = opisEkranu("Wynik", poziomWiecej, pionWiecej, piksele);
        return;
    }

    // 5. Wymiar "pomiędzy" -> dwie propozycje
    let html = "<p>Wymiar nie pasuje do siatki kabinetów 0,5 m. Do wyboru:</p>";

    if (poziomMniej > 0 && pionMniej > 0) {
        html += opisEkranu("Mniejszy ekran", poziomMniej, pionMniej, piksele);
    }
    html += opisEkranu("Większy ekran", poziomWiecej, pionWiecej, piksele);

    wynik.innerHTML = html;
});