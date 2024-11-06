import React, {Fragment} from "react";

const X = ({x, children}) => <div>Hello {x} and {children}</div>;
// comment
/* comment */
export const A = ({a}) => {
	console.log(a);
	// comment
	/* comment */
	return (
		<Fragment>
			<X x="x" />
			<X x="x">z</X>
			<X
				x="x"
				wow={<div>wow</div>}
			/>
			<X
				x="x"
				wow={() => <div>wow</div>}
			>
				{/* comment */}
				z
			</X>
		</Fragment>
	);
};
