// Rozmiar jednego kabinetu w metrach
const KABINET_M = 0.5;

// Zamienia tekst z pola na liczbę; działa i z przecinkiem (1,5), i z kropką (1.5)
function liczba(tekst) {
    return Number(tekst.trim().replace(",", "."));
}

// Ile pikseli ma jeden kabinet 500 x 500 mm przy danym pitchu
function pikseleNaKabinet(pitch) {
    if (pitch === 1.5) return 320;
    if (pitch === 1.9) return 256;
    if (pitch === 2.6) return 192;
    if (pitch === 3.9) return 128;
    return Math.round(500 / pitch);
}

// Buduje opis jednego wariantu ekranu
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
const pitchWlasnyBlok = document.getElementById("pitch_wlasny_blok");
const kafelkiPitch = document.querySelectorAll('input[name="pitch"]');

// Pokaż pole "własny pitch" tylko po wybraniu kafelka "Inny…"
kafelkiPitch.forEach(function (kafelek) {
    kafelek.addEventListener("change", function () {
        const wybrany = document.querySelector('input[name="pitch"]:checked').value;
        pitchWlasnyBlok.hidden = wybrany !== "inny";
    });
});

przycisk.addEventListener("click", function () {
    // 1. Odczyt danych
    const szerokosc_m = liczba(document.getElementById("szerokosc_m").value);
    const wysokosc_m = liczba(document.getElementById("wysokosc_m").value);

    const wybrany = document.querySelector('input[name="pitch"]:checked').value;
    let pitch;
    if (wybrany === "inny") {
        pitch = liczba(document.getElementById("pitch_wlasny").value);
    } else {
        pitch = Number(wybrany);
    }

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