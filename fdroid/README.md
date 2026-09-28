# Getting Pogo Showdown onto F-Droid

The app meets F-Droid's inclusion rules. Code is GPL-3.0-or-later and the soundtrack is CC BY-SA 4.0. There are no proprietary dependencies (Phaser, Capacitor and Vite are MIT, and the Google Services plugin was removed), no ads, no tracking, and no network requests. Keyless release builds come out unsigned for F-Droid to sign.

1. Make a GitLab account and fork https://gitlab.com/fdroid/fdroiddata.
2. Copy `com.pogoshowdown.app.yml` from this folder to `metadata/com.pogoshowdown.app.yml` in your fork.
3. Optional but recommended: install `fdroidserver` and run `fdroid readmeta`, `fdroid lint com.pogoshowdown.app` and `fdroid build -v -l com.pogoshowdown.app` in the fork.
4. Open a merge request titled "New app: Pogo Showdown". Reviewers usually adjust the build recipe, most often the Node.js setup (Vite 8 needs Node 20.19+).

Store text, the icon, the feature graphic and screenshots come from `fastlane/metadata/android/en-US/` in this repo. F-Droid reads them automatically. Add a `changelogs/<versionCode>.txt` for every release.

Release routine: bump `versionCode` and `versionName` in `android/app/build.gradle` and `version` in `package.json`, then tag `vX.Y.Z` and push the tag. `UpdateCheckMode: Tags` picks it up.

F-Droid signs with its own key, so an F-Droid install can't update over the GitHub or Play APK, or the other way round, without uninstalling first. Uninstalling clears saves.
