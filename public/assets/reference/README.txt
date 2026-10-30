Nunito font assets for the screenshot reference

Source: upstream-current/fonts/Nunito/ in this workspace, the pinned
Rhythia/Client checkout documented by the main project.

The original TrueType outlines were compressed to WOFF2 using the existing
wawoff2 dependency. No glyphs or outlines were modified.

Files and OS/2 weight classes:
  nunito-regular.woff2   400
  nunito-bold.woff2      700
  nunito-extrabold.woff2 800
  nunito-black.woff2     900

The existing public/assets/nunito-bold.woff2 is weight 700. Defining it as
the entire 400-900 range makes every requested weight use the same outlines.
Use separate @font-face rules with the weight classes above.

Embedded license notice from every source font:
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: https://scripts.sil.org/OFL

The full source font copyright and license metadata remain embedded in WOFF2.

OFL.txt contains the full license and copyright notice, retrieved from the
authoritative Google Fonts Nunito distribution:
https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt
Its copyright line exactly matches name-table entry 0 in the bundled fonts:
Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)
