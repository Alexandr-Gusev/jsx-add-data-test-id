# Add data-testid attribute to your JSX elements

Your JSX after processing
```js
import React, {Fragment} from "react";

const X = ({x, children}) => <div data-testid="ce00611a-d83d-4041-bc30-57dd49cf2b25">Hello {x} and {children}</div>;

export const A = ({a}) => {
	return (
		<Fragment data-testid="280b21dd-8ca9-4a36-904a-c8b35cf5c89e">
			<X x="x" data-testid="5de44139-6e0d-40e1-8ad3-d05f0cc08808" />
			<X x="x" data-testid="0b092c80-b0fb-4141-bfc4-fbe3742cf68b">Hello</X>
			<X
				x="x"
				wow={<div data-testid="26a8a002-e426-4367-9e00-4903f480a8a7">wow</div>}
				data-testid="79d88340-5430-4cd2-9579-e656e42c9dc5"
			/>
			<X
				x="x"
				wow={() => <div data-testid="d8d4b639-9d10-49b8-bfd1-b817931e5918">wow</div>}
				data-testid="7fbb52b6-db63-4cf3-b5c9-0574e0e516f2"
			>
				Hello
			</X>
		</Fragment>
	);
};
```

You can hide attribute values using [Inline Fold](https://marketplace.visualstudio.com/items?itemName=moalamri.inline-fold) extension for Visual Studio Code with a configuration like this
```json
{
	"inlineFold.regex": "(data-testid=\"[a-z0-9-]*\")",
	"inlineFold.regexFlags": "g",
	"inlineFold.regexGroup": 1,
	"inlineFold.maskChar": "data-testid",
	"inlineFold.maskColor": "#A0A0A0",
	"inlineFold.unfoldOnLineSelect": false
}
```

Your JSX in Visual Studio Code editor after hiding
```js
import React, {Fragment} from "react";

const X = ({x, children}) => <div data-testid>Hello {x} and {children}</div>;

export const A = ({a}) => {
	return (
		<Fragment data-testid>
			<X x="x" data-testid />
			<X x="x" data-testid>Hello</X>
			<X
				x="x"
				wow={<div data-testid>wow</div>}
				data-testid
			/>
			<X
				x="x"
				wow={() => <div data-testid>wow</div>}
				data-testid
			>
				Hello
			</X>
		</Fragment>
	);
};
```

## Installation

```bash
npm i -D jsx-add-data-test-id
```

## Usage

```bash
npx jsx-add-data-test-id --include-dirs src/js --exclude-dirs src/js/icons --id-name data-testid --ext js --indentation tab --quotes double --cache .jsx-add-data-test-id-cache.json
```

Additional options:
* allow-duplicates - allow duplicate attribute values
* disable-modification - prohibit file modification
* disable-insertion - prohibit attribute insertion (only empty attributes will be updated)

Pipeline:
* user writes code
* user executes jsx-add-data-test-id with disable-modification option
* user performs duplicate cleanup if required
* user makes commit
* CI tool executes jsx-add-data-test-id without disable-modification option and makes commit
