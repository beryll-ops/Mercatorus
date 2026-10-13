# Mapa Terenów

Proste narzędzie internetowe do pracy z przydzielonymi terenami. 

Pozwala narysować tereny w darmowych Mapach Google, a potem automatycznie stworzyć z nich kody QR do wydrukowania. Osoba w terenie skanuje kod telefonem i od razu widzi na ekranie swój teren, granice ulic oraz własną pozycję GPS.

---

## Jak to działa?


### 1. Rysujesz tereny w Google Moje Mapy
Wchodzisz na [Google Moje Mapy](https://www.google.com/maps/d/) i rysujesz granice swoich terenów. Każdy obszar nazywasz.

### 2. Aplikacja sama pobiera obrysy
Program łączy się z Twoją mapą Google i automatycznie zamienia narysowane obszary na interaktywną mapę w aplikacji. Nie musisz ręcznie kopiować plików ani przepisywać współrzędnych.

### 3. Drukujesz arkusz kodów QR
Wchodzisz na stronę główną, klikasz **„Kody QR”** i drukujesz gotowy arkusz A4:
* **Drukuj kody mapek bez nawigacji** – osoba po zeskanowaniu widzi samą czystą mapę z obrysem terenu i wskaźnikiem swojej lokalizacji.
* **Drukuj kody mapek z nawigacją** – osoba po zeskanowaniu ma dodatkowo na dole przycisk do wyznaczenia trasy (pieszo lub samochodem) i przejścia do nawigacji w aplikacji Google Maps.

### 4. Osoba skanuje kod telefonem
Gdy ktoś bierze teren do pracy:
* Celuje aparatem w kod QR na karcie terenu.
* W przeglądarce telefonu otwiera się mapa – **tylko i wyłącznie z tym jednym terenem** (nie widzi innych terenów, nie ma bałaganu).
* **Wskaźnik GPS na samej górze ekranu** od razu informuje:
  * 🟢 *„Jesteś na terenie”* – gdy stoi w granicach przydziału.
  * 🟡 *„Jesteś poza terenem (odległość do granicy: X m)”* – gdy jeszcze tam nie dotarł.
* Przycisk z ikoną satelity po prawej stronie pozwala jednym dotknięciem przełączyć na zdjęcia lotnicze, żeby zobaczyć rzeczywiste domy.

---

## Dla kogo to jest i jakie ma zalety?

* **Zero instalowania:** Działa bezpośrednio w przeglądarce telefonu (Chrome, Safari, Brave itp.). Nie trzeba pobierać żadnych aplikacji z Google Play czy App Store.
* **Proste dla każdego:** Interfejs jest maksymalnie uproszczony – sprawdzi się zarówno dla 20-latka, jak i 70-latka.
* **Brak logowania i haseł:** Nikt nie musi zakładać konta ani logować się. Kod QR to bezpośredni klucz do mapy danego terenu.
* **Prywatność:** Aplikacja nie zbiera żadnych danych osobowych, nie śledzi użytkowników i nie zapisuje ich pozycji w bazie.

---

## Konfiguracja i uruchomienie

### Wskazanie własnej mapy
W pliku `config/map-source.json` wpisujesz link do edycji oraz identyfikator swojej mapy:
```json
{
  "googleMyMapsEditUrl": "https://www.google.com/maps/d/edit?mid=TWOJE_ID_MAPY",
  "googleMapId": "TWOJE_ID_MAPY"
}
```
* Musisz także utworzyć Github Actions Secret który zawiera ID twojej mapy. 
Repozytorium/Fork > Settings > Secrets and Variables > Actions > New Repository Secret > GOOGLE_MAP_ID = id twojej mapy
* Repozytorium/Fork > Settings > Secrets and Variables > Actions > New Environment Secret > GOOGLE_MAP_ID = id twojej mapy

### Publikacja w internecie
Aplikacja jest przystosowana do darmowego hostingu na **GitHub Pages**. Każda zmiana w kodzie lub aktualizacja mapy w Google może automatycznie odświeżać stronę w internecie za pomocą wbudowanych procesów GitHub Actions.
