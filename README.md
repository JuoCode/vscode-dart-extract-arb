# Flutter Extract to ARB

## Features

This extension adds a single quick action : "Extract String to ARB" 

which does :
- Extract the selected text.
- Prompt for a key name.
- Add the key-value pair to the ARB file.
- translate the text using deepl to add it to others arb files.

## Demo


<img src="https://github.com/tempo-riz/vscode-dart-extract-arb/blob/5f1bdd05222f9a6dca29ba8a7ec3eb1e607b4b1f/demo/speed-demo.gif" width="1200"/>

## Setup

You should already have a l10n.yaml file in your project. If not, create one.
it uses flutter's official options for internationalization. see [here](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#configuring-the-l10n-yaml-file)

This plugins takes into account existing options, and extends it with the following options:


```yaml
# Plugin specific configuration
key-prefix: context.l10n.
update-all-arb-files: true # The default is false.
main-locale: en # The default is en.
auto-translate: true # The default is false.
```

For the translation feature to work, you need to add your Deepl API key in vscode settings.json file:

`"flutter.deeplApiKey": "your-key",`

And that's it! You're ready to go.

If you want to add a feature or file a bug, please open an issue on the [GitHub repository](https://github.com/tempo-riz/vscode-dart-extract-arb)

## Release Notes

### 1.0.0

Initial release !

