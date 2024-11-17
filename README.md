# Add data-testid attribute to your JSX elements

Your JSX after processing
```js
import React, {Fragment} from "react";

const X = ({x, children}) => <div data-testid="iFg6lbU1">Hello {x} and {children}</div>;

export const A = ({a}) => {
    return (
        <Fragment data-testid="S77PPbTM">
            <X x="x" data-testid="wpKMLXrM" />
            <X x="x" data-testid="kQXys89s">z</X>
            <X
                x="x"
                wow={<div data-testid="gQdhqdQZ">wow</div>}
                data-testid="evg2cFxK"
            />
            <X
                x="x"
                wow={() => <div data-testid="jx8IjU65">wow</div>}
                data-testid="7P78ztIK"
            >
                z
            </X>
        </Fragment>
    );
};
```

You can hide attribute values using [Inline Fold](https://marketplace.visualstudio.com/items?itemName=moalamri.inline-fold) extension for Visual Studio Code with a configuration like this
```json
{
    "inlineFold.regex": "(data-testid=\"[0-9A-Za-z]*\")",
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
            <X x="x" data-testid>z</X>
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
                z
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
npx jsx-add-data-test-id --include-dirs src/js --exclude-dirs src/js/icons --id-name data-testid
```

Additional options:
* extensions - js
* indentation - tab or number of spaces, default - tab
* quotes - double or single, default - double
* cache - .jsx-add-data-test-id-cache.json
* allow-duplicates - allow duplicate attribute values
* disable-modification - prohibit file modification
* disable-insertion - prohibit attribute insertion (only empty attributes will be updated)
* id-generator - nanoid or uuid4, default - nanoid

Pipeline:
* user writes code
* user executes jsx-add-data-test-id with disable-modification option
* user performs duplicate cleanup if required
* user makes commit
* CI tool executes jsx-add-data-test-id without disable-modification option and makes commit
