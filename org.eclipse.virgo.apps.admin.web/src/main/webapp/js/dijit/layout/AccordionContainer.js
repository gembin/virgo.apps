/*
	Copyright (c) 2004-2009, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/


if(!dojo._hasResource["dijit.layout.AccordionContainer"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["dijit.layout.AccordionContainer"] = true;
dojo.provide("dijit.layout.AccordionContainer");

dojo.require("dojo.fx");

dojo.require("dijit._Container");
dojo.require("dijit._Templated");
dojo.require("dijit.layout.StackContainer");
dojo.require("dijit.layout.ContentPane");

dojo.require("dijit.layout.AccordionPane");	// for back compat, remove for 2.0

dojo.declare(
	"dijit.layout.AccordionContainer",
	dijit.layout.StackContainer,
	{
		// summary:
		//		Holds a set of panes where every pane's title is visible, but only one pane's content is visible at a time,
		//		and switching between panes is visualized by sliding the other panes up/down.
		// example:
		//	| 	<div dojoType="dijit.layout.AccordionContainer">
		//	|		<div dojoType="dijit.layout.ContentPane" title="pane 1">
		//	|		</div>
		//	|		<div dojoType="dijit.layout.ContentPane" title="pane 2">
		//	|			<p>This is some text</p>
		//	|		</div>
		//	|	</div>

		// duration: Integer
		//		Amount of time (in ms) it takes to slide panes
		duration: dijit.defaultDuration,

		// buttonWidget: [const] String
		//		The name of the widget used to display the title of each pane
		buttonWidget: "dijit.layout._AccordionButton",

		// _verticalSpace: Number
		//		Pixels of space available for the open pane
		//		(my content box size minus the cumulative size of all the title bars)
		_verticalSpace: 0,

		baseClass: "dijitAccordionContainer",

		postCreate: function(){
			this.domNode.style.overflow = "hidden";
			this.inherited(arguments);
			dijit.setWaiRole(this.domNode, "tablist");
		},

		startup: function(){
			if(this._started){ return; }
			this.inherited(arguments);
			if(this.selectedChildWidget){
				var style = this.selectedChildWidget.containerNode.style;
				style.display = "";
				style.overflow = "auto";
				this.selectedChildWidget._buttonWidget._setSelectedState(true);
			}
		},

		_getTargetHeight: function(/* Node */ node){
			// summary:
			//		For the given node, returns the height that should be
			//		set to achieve our vertical space (subtract any padding
			//		we may have).
			//
			//		This is used by the animations.
			//
			//		TODO: I don't think this works correctly in IE quirks when an elements
			//		style.height including padding and borders
			var cs = dojo.getComputedStyle(node);
			return Math.max(this._verticalSpace - dojo._getPadBorderExtents(node, cs).h, 0);
		},

		layout: function(){
			// Implement _LayoutWidget.layout() virtual method.
			// Set the height of the open pane based on what room remains.

			var openPane = this.selectedChildWidget;

			// get cumulative height of all the title bars
			var totalCollapsedHeight = 0;
			dojo.forEach(this.getChildren(), function(child){
				totalCollapsedHeight += child._buttonWidget.getTitleHeight();
			});
			var mySize = this._contentBox;
			this._verticalSpace = mySize.h - totalCollapsedHeight;

			// Memo size to make displayed child
			this._containerContentBox = {
				h: this._verticalSpace,
				w: mySize.w
			};

			if(openPane){
				openPane.resize(this._containerContentBox);
			}
		},

		_setupChild: function(child){
			// Overrides _LayoutWidget._setupChild().
			// Setup clickable title to sit above the child widget,
			// and stash pointer to it inside the widget itself.

			var cls = dojo.getObject(this.buttonWidget);
			var button = (child._buttonWidget = new cls({
				contentWidget: child,
				label: child.title,
				title: child.tooltip,
				iconClass: child.iconClass,
				id: child.id + "_button",
				parent: this
			}));

			child._accordionConnectHandle = this.connect(child, 'attr', function(name, value){
				if(arguments.length == 2){
					switch(name){
					case 'title':
					case 'iconClass':
						button.attr(name, value);
					}
				}
			});

			dojo.place(child._buttonWidget.domNode, child.domNode, "before");

			this.inherited(arguments);
		},

		removeChild: function(child){
			// Overrides _LayoutWidget.removeChild().
			this.disconnect(child._accordionConnectHandle);
			delete child._accordionConnectHandle;

			child._buttonWidget.destroy();
			delete child._buttonWidget;

			this.inherited(arguments);
		},

		getChildren: function(){
			// Overrides _Container.getChildren() to ignore titles and only look at panes.
			return dojo.filter(this.inherited(arguments), function(child){
				return child.declaredClass != this.buttonWidget;
			}, this);
		},

		destroy: function(){
			dojo.forEach(this.getChildren(), function(child){
				child._buttonWidget.destroy();
			});
			this.inherited(arguments);
		},

		_transition: function(/*Widget?*/newWidget, /*Widget?*/oldWidget){
			// Overrides StackContainer._transition() to provide sliding of title bars etc.

//TODO: should be able to replace this with calls to slideIn/slideOut
			if(this._inTransition){ return; }
			this._inTransition = true;
			var animations = [];
			var paneHeight = this._verticalSpace;
			if(newWidget){
				newWidget._buttonWidget.setSelected(true);

				this._showChild(newWidget);	// prepare widget to be slid in

				// Size the new widget, in case this is the first time it's being shown,
				// or I have been resized since the last time it was shown.
				// Note that page must be visible for resizing to work.
				if(this.doLayout && newWidget.resize){
					newWidget.resize(this._containerContentBox);
				}

				var newContents = newWidget.domNode;
				dojo.addClass(newContents, "dijitVisible");
				dojo.removeClass(newContents, "dijitHidden");
				var newContentsOverflow = newContents.style.overflow;
				newContents.style.overflow = "hidden";
				animations.push(dojo.animateProperty({
					node: newContents,
					duration: this.duration,
					properties: {
						height: { start: 1, end: this._getTargetHeight(newContents) }
					},
					onEnd: dojo.hitch(this, function(){
						newContents.style.overflow = newContentsOverflow;
						delete this._inTransition;
					})
				}));
			}
			if(oldWidget){
				oldWidget._buttonWidget.setSelected(false);
				var oldContents = oldWidget.domNode,
					oldContentsOverflow = oldContents.style.overflow;
				oldContents.style.overflow = "hidden";
				animations.push(dojo.animateProperty({
					node: oldContents,
					duration: this.duration,
					properties: {
						height: { start: this._getTargetHeight(oldContents), end: 1 }
					},
					onEnd: function(){
						dojo.addClass(oldContents, "dijitHidden");
						dojo.removeClass(oldContents, "dijitVisible");
						oldContents.style.overflow = oldContentsOverflow;
						if(oldWidget.onHide){
							oldWidget.onHide();
						}
					}
				}));
			}

			dojo.fx.combine(animations).play();
		},

		// note: we are treating the container as controller here
		_onKeyPress: function(/*Event*/ e, /*dijit._Widget*/ fromTitle){
			// summary:
			//		Handle keypress events
			// description:
			//		This is called from a handler on AccordionContainer.domNode
			//		(setup in StackContainer), and is also called directly from
			//		the click handler for accordion labels
			if(this._inTransition || this.disabled || e.altKey || !(fromTitle || e.ctrlKey)){
				if(this._inTransition){
					dojo.stopEvent(e);
				}
				return;
			}
			var k = dojo.keys,
				c = e.charOrCode;
			if((fromTitle && (c == k.LEFT_ARROW || c == k.UP_ARROW)) ||
					(e.ctrlKey && c == k.PAGE_UP)){
				this._adjacent(false)._buttonWidget._onTitleClick();
				dojo.stopEvent(e);
			}else if((fromTitle && (c == k.RIGHT_ARROW || c == k.DOWN_ARROW)) ||
					(e.ctrlKey && (c == k.PAGE_DOWN || c == k.TAB))){
				this._adjacent(true)._buttonWidget._onTitleClick();
				dojo.stopEvent(e);
			}
		}
	}
);

dojo.declare("dijit.layout._AccordionButton",
	[dijit._Widget, dijit._Templated],
	{
	// summary:
	//		The title bar to click to open up an accordion pane.
	//		Internal widget used by AccordionContainer.
	// tags:
	//		private

	templateString: dojo.cache("dijit.layout", "templates/AccordionButton.html", "<div dojoAttachPoint='titleNode,focusNode' dojoAttachEvent='ondijitclick:_onTitleClick,onkeypress:_onTitleKeyPress,onfocus:_handleFocus,onblur:_handleFocus,onmouseenter:_onTitleEnter,onmouseleave:_onTitleLeave'\n\t\tclass='dijitAccordionTitle' wairole=\"tab\" waiState=\"expanded-false\"\n\t\t><span class='dijitInline dijitAccordionArrow' waiRole=\"presentation\"></span\n\t\t><span class='arrowTextUp' waiRole=\"presentation\">+</span\n\t\t><span class='arrowTextDown' waiRole=\"presentation\">-</span\n\t\t><img src=\"${_blankGif}\" alt=\"\" dojoAttachPoint='iconNode' style=\"vertical-align: middle\" waiRole=\"presentation\"/>\n\t\t<span waiRole=\"presentation\" dojoAttachPoint='titleTextNode' class='dijitAccordionText'></span>\n</div>\n"),
	attributeMap: dojo.mixin(dojo.clone(dijit.layout.ContentPane.prototype.attributeMap), {
		label: {node: "titleTextNode", type: "innerHTML" },
		title: {node: "titleTextNode", type: "attribute", attribute: "title"},
		iconClass: { node: "iconNode", type: "class" }
	}),

	baseClass: "dijitAccordionTitle",

	getParent: function(){
		// summary:
		//		Returns the parent.
		// tags:
		//		private
		return this.parent;
	},

	postCreate: function(){
		this.inherited(arguments);
		dojo.setSelectable(this.domNode, false);
		this.setSelected(this.selected);
		var titleTextNodeId = dojo.attr(this.domNode,'id').replace(' ','_');
		dojo.attr(this.titleTextNode, "id", titleTextNodeId+"_title");
		dijit.setWaiState(this.focusNode, "labelledby", dojo.attr(this.titleTextNode, "id"));
	},

	getTitleHeight: function(){
		// summary:
		//		Returns the height of the title dom node.
		return dojo.marginBox(this.titleNode).h;	// Integer
	},

	_onTitleClick: function(){
		// summary:
		//		Callback when someone clicks my title.
		var parent = this.getParent();
		if(!parent._inTransition){
			parent.selectChild(this.contentWidget);
			dijit.focus(this.focusNode);
		}
	},

	_onTitleEnter: function(){
		// summary:
		//		Callback when someone hovers over my title.
		dojo.addClass(this.focusNode, "dijitAccordionTitle-hover");
	},

	_onTitleLeave: function(){
		// summary:
		//		Callback when someone stops hovering over my title.
		dojo.removeClass(this.focusNode, "dijitAccordionTitle-hover");
	},

	_onTitleKeyPress: function(/*Event*/ evt){
		return this.getParent()._onKeyPress(evt, this.contentWidget);
	},

	_setSelectedState: function(/*Boolean*/ isSelected){
		this.selected = isSelected;
		dojo[(isSelected ? "addClass" : "removeClass")](this.titleNode,"dijitAccordionTitle-selected");
		dijit.setWaiState(this.focusNode, "expanded", isSelected);
		dijit.setWaiState(this.focusNode, "selected", isSelected);
		this.focusNode.setAttribute("tabIndex", isSelected ? "0" : "-1");
	},

	_handleFocus: function(/*Event*/ e){
		// summary:
		//		Handle the blur and focus state of this widget.
		dojo.toggleClass(this.titleTextNode, "dijitAccordionFocused", e.type == "focus");
	},

	setSelected: function(/*Boolean*/ isSelected){
		// summary:
		//		Change the selected state on this pane.
		this._setSelectedState(isSelected);
		if(isSelected){
			var cw = this.contentWidget;
			if(cw.onSelected){ cw.onSelected(); }
		}
	}
});

}
