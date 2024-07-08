# Directus Extension URL File Import (Operation)
This extension adds a URL File Import Operation to Directus.

![URL File Import Operation](./screenshot.png?raw=true "URL File Import Operation")

It is similar to the import function in the FilesService with the following (extra) features.

## Different HTTP Methods
You can specify the HTTP method like 'GET,POST' etc.

## Import URL
Set the URL from where you want to import a Image

## HTTP Headers
You can set HTTP Headers. Some external URL's will need API keys or Auth tokens. You can specify these here.

## Folder
This can be used to enter the (virtual) folder id where the file should be linked to in Directus.

## Body
You can send a HTTP Body if needed.

## Installation

First build your extension
```bash
cd directus-extension-url-file-import
npm run build
```

Then make sure to copy this folder into /directus/extensions (eg. docker) or /directus/api/extensions (local) and restart your app.