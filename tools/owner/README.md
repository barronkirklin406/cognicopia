# The owner's tools

This folder is for the owner of Cognicopia only. The website does not publish it (`_config.yml` at the top of the repository tells GitHub Pages to leave it out), so nothing here has an address on cognicopia.org.

## License Desk (`license-desk.html`)

The page that makes license keys for facilities: paid licenses, and 30-day pilot keys. It runs entirely in your web browser from a copy on your own computer and cannot send anything anywhere. Your secret key file never leaves your computer.

### How to open it (Windows)

These steps come from GitHub's own documentation, not from a screen we have seen on your computer, so a button may be worded a little differently for you. Do one step at a time.

1. In a web browser, go to `https://github.com/barronkirklin406/cognicopia`.
2. Find the green button labeled **Code** and press it. In the small menu that opens, choose **Download ZIP**. A file named something like `cognicopia-main.zip` lands in your Downloads folder.
3. In File Explorer, open Downloads, right-click that file and choose **Extract All**, then **Extract**. You now have an ordinary folder named `cognicopia-main`.
4. Open that folder, then `tools`, then `owner`, and double-click `license-desk.html`. It opens in your web browser.

Leave `license-desk.html` where it is inside the folder: it uses other files from the same download, and it will not work if it is moved out on its own.

Download a fresh copy (steps 2 to 4) whenever the site has changed, so the desk and the site agree about what a valid key is.

### What stays the same

- Your secret file (`cognicopia-license-private.pem`) is not in this download and never should be. Keep it where you already keep it.
- `scripts/check-license-desk-ui.mjs` tests this page in a real browser on every build.
