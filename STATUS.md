# Vellum Frontend — Estado del proyecto

## Configuración

- [x] React Native 0.85.3 (bare, sin Expo)
- [x] Yarn como package manager
- [x] TypeScript
- [x] React Navigation (native-stack + bottom-tabs)
- [x] Zustand para estado global
- [x] API client con JWT + AsyncStorage
- [x] Babel + Metro configurados
- [x] Path alias `@/` → `src/*`

## Auth

- [x] SignInScreen
- [x] SignUpScreen
- [x] ForgotPasswordScreen
- [x] ProfileScreen
- [x] Auth store (signIn, signUp, signOut, loadSession)
- [x] JWT almacenado en AsyncStorage

## Library

- [x] LibraryScreen (lista + upload)
- [x] SearchScreen (placeholder)
- [x] Upload via document picker → R2 → create book
- [x] Library store (fetchBooks, deleteBook, updateProgress)

## Reader

- [x] ReaderScreen (EPUB/PDF routing)
- [x] EpubReader (WebView + epubjs)
- [x] PdfReader (react-native-pdf)

## Navegación

- [x] Auth stack (SignIn, SignUp, ForgotPassword)
- [x] Main tabs (Library, Search, Profile)
- [x] Reader screen (modal slide from bottom)

## Pendientes

- [ ] Pasar de la migración de Expo y restablecer el proyecto desde RN 0.85.3
- [ ] Pasar a RN 0.85.3 con bare React Native + Yarn
- [ ] Pasar a completar el diseño de las pantallas
- [ ] Pasar a implementar highlight/notes UI
- [ ] Pasar a pull-to-refresh en Library
- [ ] Pasar a rate limiting y Zod en backend
- [ ] Paginación en listados

## Cómo correr

```bash
# Backend (terminal 1)
cd vellum_backend
pnpm dev

# Túnel ADB
adb reverse tcp:8080 tcp:8080

# Frontend (terminal 2)
cd vellum_frontend
npx react-native run-android  # primera vez (build + install)
npx react-native start        # después solo Metro
```
