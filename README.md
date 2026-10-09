# deepseek-listener
Minimal parser from chat.deepseek to VS code

Setup:
- Add listener.js to the VS code project folder root
- run in terminal with
````markdown
node listener.js
````
- Add and enable the tampermonkey script
- Attach project files to chat.deepseek in a single txt that mentions the addresses of the files. To generate a txt out of the full project use your own script or my example for godot
- Add instruction to format the response with the regex:

````markdown
Edit files using this exact format:
[FILE: relative/path.ext]
[REPLACE_FROM: first line of section to replace, verbatim]
[REPLACE_TO: last line of section to replace, verbatim]
```lang
replacement lines
````
