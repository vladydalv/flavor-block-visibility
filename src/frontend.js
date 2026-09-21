/**
 * Flavor Block Visibility — accessible column order.
 *
 * Columns are already ordered visually by CSS. This script moves the column
 * nodes so DOM, keyboard and screen reader order match, then neutralizes the
 * CSS order. Without JS the CSS order still applies.
 *
 * @package flavor-block-visibility
 */
( function () {
	'use strict';

	var cfg = window.flbvisFrontend;
	if ( ! cfg || ! cfg.mq || ! window.matchMedia ) {
		return;
	}

	var devices = [ 'mobile', 'tablet', 'desktop' ];
	var queries = devices.map( function ( d ) {
		return window.matchMedia( cfg.mq[ d ] );
	} );
	// moveBefore() keeps iframe/video state and focus; appendChild() reloads iframes.
	var canMove = typeof Element.prototype.moveBefore === 'function';

	function currentDevice() {
		for ( var i = 0; i < queries.length; i++ ) {
			if ( queries[ i ].matches ) {
				return devices[ i ];
			}
		}
		return null;
	}

	function move( parent, node ) {
		if ( canMove ) {
			try {
				parent.moveBefore( node, null );
				return;
			} catch ( e ) {}
		}
		parent.appendChild( node );
	}

	function init() {
		var items = [];

		Array.prototype.forEach.call( document.querySelectorAll( '.flbvis-has-order' ), function ( el ) {
			if ( ! canMove && el.querySelector( 'iframe,video,audio,object,embed' ) ) {
				return; // Keep CSS-only order to avoid reloading media.
			}
			var cols = Array.prototype.slice.call( el.children );
			var allColumns = cols.every( function ( n ) {
				return n.classList.contains( 'wp-block-column' );
			} );
			if ( cols.length > 1 && allColumns ) {
				items.push( { el: el, cols: cols } );
			}
		} );

		if ( ! items.length ) {
			return;
		}

		function apply() {
			var device = currentDevice();

			items.forEach( function ( item ) {
				var target = item.cols;
				var attr = device ? item.el.getAttribute( 'data-flbvis-order-' + device ) : null;

				if ( attr ) {
					var mapped = attr.split( ',' ).map( function ( i ) {
						return item.cols[ parseInt( i, 10 ) ];
					} );
					if ( mapped.length === item.cols.length && mapped.every( Boolean ) ) {
						target = mapped;
					}
				}

				var current = item.el.children;
				var changed = target.some( function ( n, i ) {
					return current[ i ] !== n;
				} );

				if ( changed ) {
					var active = document.activeElement;
					target.forEach( function ( n ) {
						move( item.el, n );
					} );
					if ( active && active !== document.activeElement && item.el.contains( active ) ) {
						try {
							active.focus( { preventScroll: true } );
						} catch ( e ) {}
					}
				}

				item.el.classList.add( 'flbvis-dom-ordered' );
			} );
		}

		apply();

		queries.forEach( function ( q ) {
			if ( q.addEventListener ) {
				q.addEventListener( 'change', apply );
			} else if ( q.addListener ) {
				q.addListener( apply );
			}
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
