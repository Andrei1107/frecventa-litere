# ==========================================
# Etapa 1: Build Frontend (React + Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Etapa 2: Build Backend (Spring Boot + Tika)
# ==========================================
FROM maven:3.9-eclipse-temurin-17-alpine AS backend-builder
WORKDIR /app

# Copiem fișierele pom și codul sursă Java
COPY backend/pom.xml ./backend/
COPY backend/src ./backend/src/

# Copiem bundle-ul frontend compilat în resursele statice Spring Boot
COPY --from=frontend-builder /app/frontend/dist ./backend/src/main/resources/static/

# Compilăm jar-ul executabil
RUN mvn -f ./backend/pom.xml clean package -DskipTests

# ==========================================
# Etapa 3: Imaginea finală de rulare
# ==========================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Creăm un user non-root conform bunelor practici Hugging Face Spaces
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=backend-builder /app/backend/target/frecventa-litere-1.0.0.jar app.jar

# Portul implicit 7860 (Hugging Face), sau suprascris automat de Render prin variabila PORT
ENV PORT=7860
EXPOSE 7860

ENTRYPOINT ["java", "-Xmx420m", "-XX:+UseSerialGC", "-jar", "app.jar"]
