# Frecvența literelor (Spring Boot + React)

Proiect full-stack (Spring Boot & React) pentru procesarea documentelor (.pdf, .docx, .txt) și extragerea frecvențelor literelor, cu vizualizare grafică a distribuției statistice.

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
- `POST /api/compare` (JSON `{a, b}` cu două rezultate de analiză) → diferențe pe literă și litere lipsă
