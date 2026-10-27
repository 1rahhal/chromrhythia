# Shared hosting and offline cache

Production runs on managed cloud Workers with an R2 map bucket. It does not use your PC as a server. The canonical site is https://chromrhythia-rahhal.burnydeveloper.chatgpt.site and the source repository is https://github.com/1rahhal/chromrhythia.

The game password is configured through the ignored local access-key file and a hosted PASSWORD_HASH secret. The password is never committed. The encrypted game bundle is compressed before encryption; browser dependencies are bundled, with no runtime CDN requirements. A service worker installs the core assets once. Source archives are downloaded only when requested.

The library index contains metadata only. Selecting a cloud map downloads that map with a progress indicator, verifies its SHA-256 and stores the parsed chart and audio in IndexedDB. After downloading it once, it can be played offline. Browser caches can be removed by device policies or clearing site data.

The Upload maps button shares imported SSPM/PHXM/RHM charts with every visitor holding the game password. Text charts and their paired audio are converted to PHXM for upload. Maps are stored in R2 and served only through the password-protected API. Current limit: 64 MB per shared map. Refresh the library to see new uploads without downloading their audio. Removing a local download does not delete the shared map.

GitHub Pages can serve a standalone static build, but shared uploads need the Worker/R2 backend. The hosted Worker is the intended deployment for this project. npm run dev is only a temporary local development preview.
