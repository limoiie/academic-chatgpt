# Academic Chatgpt

A chatbot that allows users to chat with a collection of documents files.
It is built on [Nuxt 3](https://nuxt.com/) + [tauri](https://tauri.app/).

## Setup

Make sure to install the dependencies:

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install
```

Do not forget to create the database schema at the first run:

```bash
cargo prisma generate --schema=./src-tauri/prisma/schema.prisma
```

## Development Server

Start the development server on http://localhost:3000

```bash
cargo tauri dev
```

## Production

Build the application for production:

```bash
cargo tauri build
```
