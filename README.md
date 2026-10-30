# Frecvența literelor (Spring Boot + React)

Încarci fișiere (.txt, .pdf, .doc, .docx, ...). Backend-ul extrage textul cu Apache Tika și calculează:
total litere, caractere distincte (față de cele 31 ale alfabetului românesc), frecvența absolută și relativă,
raportul vocale/consoane. Frontend-ul desenează graficele (bar/pie) și compară automat ultimele două fișiere încărcate.

## Rulare
Necesită JDK 17+, Maven și Node 18+.

```bash
# Terminal 1
cd backend && mvn spring-boot:run      # http://localhost:8080

# Terminal 2
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## API
- `POST /api/analyze` (multipart, câmp `file`) → statistici pentru un fișier
- `POST /api/compare` (JSON `{a, b}` cu două rezultate de analiză) → diferențe pe literă, litere lipsă, similaritate cosinus, distanță de variație totală
