# Harvest Haven Android App

This is a small Android Studio wrapper for Harvest Haven. It opens your deployed Harvest Haven web app inside a native Android WebView, so players install it like a normal app.

## Setup

1. Open this folder in Android Studio:

   `C:\Users\abdur\harvest-haven\android-harvest-haven-app`

2. Open:

   `app/build.gradle`

3. Replace this placeholder with your real Vercel URL:

   ```gradle
   buildConfigField "String", "HARVEST_HAVEN_URL", "\"https://YOUR-VERCEL-URL.vercel.app\""
   ```

   Example:

   ```gradle
   buildConfigField "String", "HARVEST_HAVEN_URL", "\"https://harvest-haven.vercel.app\""
   ```

4. In Android Studio, click **Sync Now**.

5. Build the app:

   **Build > Build Bundle(s) / APK(s) > Build APK(s)**

## Notes

- Firebase login and saved progress still work through the Harvest Haven web app.
- Users need internet access because the app loads your Vercel deployment.
- For Google Play release, use **Build Bundle(s) / APK(s) > Build Bundle(s)** to create an `.aab`.
