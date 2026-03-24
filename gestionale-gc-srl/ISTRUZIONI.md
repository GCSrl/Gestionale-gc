# Gestionale G.C. srl - Guida completa

## Metodo consigliato: Deploy online su Render.com (GRATUITO)

Con questo metodo l'app sara' accessibile da ovunque: ufficio, cantiere, casa.

### Passo 1: Crea un account GitHub (se non ce l'hai)
1. Vai su https://github.com e registrati (gratuito)
2. Crea un nuovo repository: clicca "New" > nome "gestionale-gc" > "Create repository"
3. Carica tutti i file della cartella `gestionale-gc-srl` nel repository

### Passo 2: Pubblica su Render.com (gratuito)
1. Vai su https://render.com e registrati con il tuo account GitHub
2. Clicca "New" > "Web Service"
3. Seleziona il repository "gestionale-gc" che hai appena creato
4. Configura cosi':
   - **Name**: gestionale-gc
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Clicca "Create Web Service"
6. Dopo 2-3 minuti avrai un indirizzo tipo: `https://gestionale-gc.onrender.com`

### Passo 3: Condividi il link
- Manda il link a tutti (ufficio e operai)
- Ogni persona accede con il proprio nome e PIN
- Funziona da PC e da telefono, ovunque ci sia internet

---

## Metodo alternativo: Installazione locale in ufficio

### Requisiti
- Un computer con Node.js installato (https://nodejs.org - versione LTS)

### Installazione
```
cd gestionale-gc-srl
npm install
npm start
```

Apri http://localhost:3000 nel browser.

Per l'accesso dalla rete locale (altri PC, telefoni in Wi-Fi):
- Windows: apri il Prompt dei comandi e digita `ipconfig` > cerca "Indirizzo IPv4"
- Mac: Preferenze di Sistema > Rete
- Usa: http://[TUO-IP]:3000

---

## Credenziali di accesso (PIN)

Al primo avvio i PIN di default sono:
- **Ufficio**: 0000
- **Operai**: 1234

IMPORTANTE: Cambiate i PIN al primo accesso!
Per cambiare PIN: clicca sul tuo nome in alto a destra > "Cambia PIN"

## Sicurezza
- Ogni utente ha un PIN personale
- Gli operai vedono SOLO i propri interventi
- Solo l'ufficio puo' creare, modificare ed eliminare interventi
- Le sessioni sono protette con token crittografici

## Backup
Il database e' nel file `database.json`. Copiatelo periodicamente per sicurezza.

## Note su Render.com (piano gratuito)
- L'app si "addormenta" dopo 15 minuti di inattivita' e si risveglia al primo accesso (ci mette circa 30 secondi)
- Per un servizio sempre attivo, il piano a pagamento costa circa 7 dollari/mese
- I dati restano salvati nel file database.json sul server
