/**
 * Flavor Block Visibility — Editor Script
 *
 * Adds "Responsive Conditions" toggles into the Advanced panel
 * of every Gutenberg block, plus device-aware visual indicators,
 * and a per-device column order panel for core/columns.
 *
 * @package flavor-block-visibility
 */
( function () {
    var compose     = wp.compose;
    var element     = wp.element;
    var blockEditor = wp.blockEditor;
    var components  = wp.components;
    var hooks       = wp.hooks;
    var i18n        = wp.i18n;
    var data        = wp.data;

    var createHigherOrderComponent = compose.createHigherOrderComponent;
    var useState    = element.useState;
    var useEffect   = element.useEffect;
    var useRef      = element.useRef;
    var useMemo     = element.useMemo;
    var Fragment    = element.Fragment;
    var el          = element.createElement;
    var InspectorAdvancedControls = blockEditor.InspectorAdvancedControls;
    var InspectorControls = blockEditor.InspectorControls;
    var ToggleControl = components.ToggleControl;
    var PanelBody   = components.PanelBody;
    var TabPanel    = components.TabPanel;
    var Button      = components.Button;
    var Dashicon    = components.Dashicon;
    var Draggable   = components.Draggable;
    var useSelect   = data.useSelect;
    var useInstanceId = compose.useInstanceId;
    var addFilter   = hooks.addFilter;
    var __          = i18n.__;
    var sprintf     = i18n.sprintf;
    var speak       = ( wp.a11y && wp.a11y.speak ) || function () {};
    var TD          = 'flavor-block-visibility';

    // Breakpoints from PHP.
    var bp = ( window.flbvisSettings && window.flbvisSettings.breakpoints ) || {
        mobile_max: 767,
        tablet_min: 768,
        tablet_max: 1024,
        desktop_min: 1025,
    };

    // ─── helpers ─────────────────────────────────────────────────────────────

    // Current editor preview device: core/editor getDeviceType() (WP 6.5+),
    // with the older edit-site / edit-post selectors as fallback for WP 6.2–6.4.
    function selectPreviewDeviceType( select ) {
        var editor = select( 'core/editor' );
        if ( editor && typeof editor.getDeviceType === 'function' ) {
            return editor.getDeviceType() || 'Desktop';
        }
        var stores = [ 'core/edit-site', 'core/edit-post' ];
        for ( var i = 0; i < stores.length; i++ ) {
            var store = select( stores[ i ] );
            if ( store && typeof store.__experimentalGetPreviewDeviceType === 'function' ) {
                return store.__experimentalGetPreviewDeviceType() || 'Desktop';
            }
        }
        return 'Desktop';
    }

    function useDeviceType() {
        return useSelect( selectPreviewDeviceType, [] );
    }

    function isHiddenOnDevice( attrs, device ) {
        if ( device === 'Mobile'  && attrs.flbvisHideOnMobile  ) return true;
        if ( device === 'Tablet'  && attrs.flbvisHideOnTablet  ) return true;
        if ( device === 'Desktop' && attrs.flbvisHideOnDesktop ) return true;
        return false;
    }

    function hasAnyFlag( attrs ) {
        return !!( attrs.flbvisHideOnDesktop || attrs.flbvisHideOnTablet || attrs.flbvisHideOnMobile || hasColumnOrder( attrs ) );
    }

    // ─── column order helpers ────────────────────────────────────────────────

    var DEVICES = [
        { key: 'mobile',  label: __( 'Mobile', TD ),  icon: 'smartphone', range: '\u2264 ' + bp.mobile_max + 'px' },
        { key: 'tablet',  label: __( 'Tablet', TD ),  icon: 'tablet',     range: bp.tablet_min + '\u2013' + bp.tablet_max + 'px' },
        { key: 'desktop', label: __( 'Desktop', TD ), icon: 'desktop',    range: '\u2265 ' + bp.desktop_min + 'px' },
    ];

    function deviceKey( previewDevice ) {
        if ( previewDevice === 'Mobile' ) return 'mobile';
        if ( previewDevice === 'Tablet' ) return 'tablet';
        return 'desktop';
    }

    function naturalOrder( n ) {
        var a = [];
        for ( var i = 0; i < n; i++ ) a.push( i );
        return a;
    }

    // "2,0,1" → [2,0,1] (position → original column index). Invalid → natural.
    function parseOrder( str, n ) {
        if ( typeof str !== 'string' || ! str ) return naturalOrder( n );
        var parts = str.split( /[\s,]+/ ).filter( Boolean ).map( Number );
        if ( parts.length !== n ) return naturalOrder( n );
        var seen = {};
        for ( var i = 0; i < parts.length; i++ ) {
            var p = parts[ i ];
            if ( ! ( p >= 0 && p < n ) || p % 1 !== 0 || seen[ p ] ) return naturalOrder( n );
            seen[ p ] = true;
        }
        return parts;
    }

    function isNatural( arr ) {
        return arr.every( function ( v, i ) { return v === i; } );
    }

    function orderToString( arr ) {
        return isNatural( arr ) ? '' : arr.join( ',' );
    }

    function hasColumnOrder( attrs ) {
        var o = attrs.flbvisColumnOrder;
        return !!( o && ( o.mobile || o.tablet || o.desktop ) );
    }

    function cleanOrderConfig( cfg ) {
        var next = {};
        DEVICES.forEach( function ( d ) {
            if ( cfg[ d.key ] ) next[ d.key ] = cfg[ d.key ];
        } );
        return Object.keys( next ).length ? next : undefined;
    }

    // First readable text inside a column, to help identify it in the list.
    function blockExcerpt( block ) {
        var stack = [ block ];
        while ( stack.length ) {
            var b = stack.shift();
            var a = b.attributes || {};
            var c = a.content;
            if ( c ) {
                if ( typeof c !== 'string' ) {
                    c = typeof c.toHTMLString === 'function' ? c.toHTMLString() : String( c );
                }
                var text = c.replace( /<[^>]*>/g, ' ' ).replace( /\s+/g, ' ' ).trim();
                if ( text ) return text;
            }
            if ( typeof a.alt === 'string' && a.alt.trim() ) return a.alt.trim();
            if ( b.innerBlocks && b.innerBlocks.length ) stack = stack.concat( b.innerBlocks );
        }
        return '';
    }

    // Order position of a column on the current preview device (editor canvas).
    function useColumnCanvasOrder( props, device ) {
        var key = deviceKey( device );
        return useSelect( function ( select ) {
            if ( props.name !== 'core/column' ) return null;
            var be  = select( 'core/block-editor' );
            var pid = be.getBlockRootClientId( props.clientId );
            if ( ! pid || be.getBlockName( pid ) !== 'core/columns' ) return null;
            var cfg = be.getBlockAttributes( pid ).flbvisColumnOrder;
            if ( ! cfg || ! cfg[ key ] ) return null;
            var ids = be.getBlockOrder( pid );
            var arr = parseOrder( cfg[ key ], ids.length );
            if ( isNatural( arr ) ) return null;
            return arr.indexOf( ids.indexOf( props.clientId ) );
        }, [ props.clientId, props.name, key ] );
    }

    // ─── column order: keep stored order in sync with added/removed/moved columns ─

    function ColumnOrderSync( props ) {
        var ids = useSelect( function ( select ) {
            return select( 'core/block-editor' ).getBlockOrder( props.clientId );
        }, [ props.clientId ] );
        var prevRef = useRef( ids );

        useEffect( function () {
            var prev = prevRef.current;
            prevRef.current = ids;
            var cfg = props.attributes.flbvisColumnOrder;
            if ( ! cfg || prev === ids || ! prev.length ) return;
            if ( prev.length === ids.length && prev.every( function ( id, i ) { return id === ids[ i ]; } ) ) return;

            var next = {};
            var changed = false;
            DEVICES.forEach( function ( d ) {
                var str = cfg[ d.key ];
                if ( ! str ) return;
                // Only remap orders that match the previous column set. Anything
                // else (inner blocks still loading, undo in progress) is kept as is.
                if ( str.split( ',' ).length !== prev.length || isNatural( parseOrder( str, prev.length ) ) ) {
                    next[ d.key ] = str;
                    return;
                }
                var mapped = [];
                parseOrder( str, prev.length ).forEach( function ( o ) {
                    var ni = ids.indexOf( prev[ o ] );
                    if ( ni >= 0 ) mapped.push( ni );
                } );
                for ( var i = 0; i < ids.length; i++ ) {
                    if ( mapped.indexOf( i ) < 0 ) mapped.push( i );
                }
                var out = ids.length > 1 ? orderToString( mapped ) : '';
                if ( out ) next[ d.key ] = out;
                if ( out !== str ) changed = true;
            } );

            if ( changed ) {
                props.setAttributes( { flbvisColumnOrder: cleanOrderConfig( next ) } );
            }
        }, [ ids ] );

        return null;
    }

    // ─── column order: sortable list ─────────────────────────────────────────

    var DRAG_HANDLE_ICON = el(
        'svg',
        { width: 24, height: 24, viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', focusable: 'false' },
        el( 'path', { fill: 'currentColor', d: 'M8 7h2V5H8v2zm0 6h2v-2H8v2zm0 6h2v-2H8v2zm6-14v2h2V5h-2zm0 8h2v-2h-2v2zm0 6h2v-2h-2v2z' } )
    );

    function OrderList( props ) {
        var ids    = props.ids;
        var labels = props.labels;
        var n      = ids.length;
        var order  = parseOrder( props.value, n );
        var modified = ! isNatural( order );

        var sDrag = useState( null ), dragFrom = sDrag[0], setDragFrom = sDrag[1];
        var sDrop = useState( null ), dropAt = sDrop[0], setDropAt = sDrop[1];
        var uid = 'flbvis-co-' + useInstanceId( OrderList );
        var highlighted = useRef( null );

        function highlight( id ) {
            var prev = highlighted.current;
            if ( prev === id ) return;
            var dispatch = data.dispatch( 'core/block-editor' );
            if ( prev ) dispatch.toggleBlockHighlight( prev, false );
            highlighted.current = id;
            if ( id ) dispatch.toggleBlockHighlight( id, true );
        }

        useEffect( function () {
            return function () { highlight( null ); };
        }, [] );

        function commit( next, movedOriginal, newPos ) {
            props.onChange( orderToString( next ) );
            if ( typeof movedOriginal === 'number' ) {
                /* translators: 1: column number, 2: new position */
                speak( sprintf( __( 'Column %1$d moved to position %2$d.', TD ), movedOriginal + 1, newPos + 1 ) );
            }
        }

        function moveTo( from, to ) {
            if ( to < 0 || to >= n || from === to ) return;
            var next = order.slice();
            var item = next.splice( from, 1 )[0];
            next.splice( to, 0, item );
            commit( next, item, to );
        }

        function endDrag() {
            setDragFrom( null );
            setDropAt( null );
        }

        function onDragOverRow( pos ) {
            return function ( e ) {
                if ( dragFrom === null ) return;
                e.preventDefault();
                if ( e.dataTransfer ) e.dataTransfer.dropEffect = 'move';
                var rect = e.currentTarget.getBoundingClientRect();
                var at = e.clientY < rect.top + rect.height / 2 ? pos : pos + 1;
                if ( at !== dropAt ) setDropAt( at );
            };
        }

        function onDropRow( e ) {
            e.preventDefault();
            if ( dragFrom !== null && dropAt !== null ) {
                moveTo( dragFrom, dropAt > dragFrom ? dropAt - 1 : dropAt );
            }
            endDrag();
        }

        var showIndicator = dragFrom !== null && dropAt !== null && dropAt !== dragFrom && dropAt !== dragFrom + 1;

        return el(
            'div',
            { className: 'flbvis-co' },
            el(
                'div',
                { className: 'flbvis-co__meta' },
                el( 'span', { className: 'flbvis-co__range' }, props.device.label + ' \u00b7 ' + props.device.range ),
                el(
                    'div',
                    { className: 'flbvis-co__actions' },
                    el( Button, {
                        variant: 'tertiary',
                        size: 'small',
                        onClick: function () { commit( naturalOrder( n ).reverse() ); },
                    }, __( 'Reverse', TD ) ),
                    el( Button, {
                        variant: 'tertiary',
                        size: 'small',
                        disabled: ! modified,
                        onClick: function () { props.onChange( '' ); },
                    }, __( 'Reset', TD ) )
                )
            ),
            el(
                'ol',
                { className: 'flbvis-co__list' + ( dragFrom !== null ? ' is-sorting' : '' ) },
                order.map( function ( orig, pos ) {
                    var rowId = uid + '-' + orig;
                    var className = 'flbvis-co__item' +
                        ( dragFrom === pos ? ' is-dragging' : '' ) +
                        ( showIndicator && dropAt === pos ? ' is-drop-before' : '' ) +
                        ( showIndicator && dropAt === n && pos === n - 1 ? ' is-drop-after' : '' );
                    /* translators: %d: column number */
                    var name = sprintf( __( 'Column %d', TD ), orig + 1 );

                    return el(
                        'li',
                        {
                            key: orig,
                            id: rowId,
                            className: className,
                            onDragOver: onDragOverRow( pos ),
                            onDrop: onDropRow,
                            onMouseEnter: function () { if ( dragFrom === null ) highlight( ids[ orig ] ); },
                            onMouseLeave: function () { highlight( null ); },
                            onFocus: function () { highlight( ids[ orig ] ); },
                            onBlur: function () { highlight( null ); },
                        },
                        el(
                            Draggable,
                            {
                                elementId: rowId,
                                transferData: { type: 'flbvis-column-order', position: pos },
                                onDragStart: function () { highlight( null ); setDragFrom( pos ); },
                                onDragEnd: endDrag,
                            },
                            function ( dp ) {
                                return el( 'span', {
                                    className: 'flbvis-co__handle',
                                    draggable: true,
                                    onDragStart: dp.onDraggableStart,
                                    onDragEnd: dp.onDraggableEnd,
                                    title: __( 'Drag to reorder', TD ),
                                    'aria-hidden': 'true',
                                }, DRAG_HANDLE_ICON );
                            }
                        ),
                        el( 'span', { className: 'flbvis-co__pos', 'aria-hidden': 'true' }, pos + 1 ),
                        el(
                            'span',
                            { className: 'flbvis-co__label' },
                            el( 'span', { className: 'flbvis-co__name' }, name ),
                            labels[ orig ] && el( 'span', { className: 'flbvis-co__excerpt' }, labels[ orig ] )
                        ),
                        el(
                            'span',
                            { className: 'flbvis-co__btns' },
                            el( Button, {
                                icon: 'arrow-up-alt2',
                                size: 'small',
                                /* translators: %s: column name */
                                label: sprintf( __( 'Move %s up', TD ), name ),
                                disabled: pos === 0,
                                onClick: function () { moveTo( pos, pos - 1 ); },
                            } ),
                            el( Button, {
                                icon: 'arrow-down-alt2',
                                size: 'small',
                                /* translators: %s: column name */
                                label: sprintf( __( 'Move %s down', TD ), name ),
                                disabled: pos === n - 1,
                                onClick: function () { moveTo( pos, pos + 1 ); },
                            } )
                        )
                    );
                } )
            )
        );
    }

    // ─── column order: inspector panel ───────────────────────────────────────

    function ColumnOrderPanel( props ) {
        var attrs = props.attributes;
        var inner = useSelect( function ( select ) {
            return select( 'core/block-editor' ).getBlocks( props.clientId );
        }, [ props.clientId ] );
        var ids    = useMemo( function () { return inner.map( function ( b ) { return b.clientId; } ); }, [ inner ] );
        var labels = useMemo( function () { return inner.map( blockExcerpt ); }, [ inner ] );
        var cfg    = attrs.flbvisColumnOrder || {};

        function setDeviceOrder( device, str ) {
            var next = Object.assign( {}, cfg );
            next[ device ] = str;
            props.setAttributes( { flbvisColumnOrder: cleanOrderConfig( next ) } );
        }

        return el(
            InspectorControls,
            null,
            el(
                PanelBody,
                {
                    title: __( 'Responsive Column Order', TD ),
                    initialOpen: hasColumnOrder( attrs ),
                    className: 'flbvis-co-panel',
                },
                ids.length < 2
                    ? el( 'p', { className: 'flbvis-co__empty' }, __( 'Add at least two columns to change their order per device.', TD ) )
                    : el(
                        TabPanel,
                        {
                            key: props.device,
                            className: 'flbvis-co__tabs',
                            initialTabName: deviceKey( props.device ),
                            tabs: DEVICES.map( function ( d ) {
                                return {
                                    name: d.key,
                                    title: d.label,
                                    icon: el( Dashicon, { icon: d.icon } ),
                                    className: 'flbvis-co__tab' + ( cfg[ d.key ] ? ' has-changes' : '' ),
                                    device: d,
                                };
                            } ),
                        },
                        function ( tab ) {
                            return el( OrderList, {
                                key: tab.name,
                                device: tab.device,
                                ids: ids,
                                labels: labels,
                                value: cfg[ tab.name ] || '',
                                onChange: function ( str ) { setDeviceOrder( tab.name, str ); },
                            } );
                        }
                    )
            )
        );
    }

    // ─── 1. Register attributes ───────────────────────────────────────────────

    addFilter(
        'blocks.registerBlockType',
        'flavor-block-visibility/add-responsive-attributes',
        function ( settings, name ) {
            if ( ! settings.attributes ) settings.attributes = {};
            if ( name === 'core/columns' ) {
                settings.attributes.flbvisColumnOrder = { type: 'object' };
            }
            settings.attributes.flbvisHideOnDesktop = { type: 'boolean', default: false };
            settings.attributes.flbvisHideOnTablet  = { type: 'boolean', default: false };
            settings.attributes.flbvisHideOnMobile  = { type: 'boolean', default: false };
            return settings;
        }
    );

    // ─── 2. Visual indicator + canvas column order (editor.BlockListBlock) ────
    //
    // Styles go on the block's own wrapper via wrapperProps (merged by
    // useBlockProps), so no extra div is added. An extra div would become the
    // flex item inside core/columns and break column widths in the editor.

    addFilter(
        'editor.BlockListBlock',
        'flavor-block-visibility/with-responsive-indicator',
        createHigherOrderComponent( function ( BlockListBlock ) {
            return function ( props ) {
                var attrs       = props.attributes || {};
                var device      = useDeviceType();
                var canvasOrder = useColumnCanvasOrder( props, device );

                var style = {};
                if ( isHiddenOnDevice( attrs, device ) ) {
                    style.opacity  = '0.3';
                    style.filter   = 'grayscale(1)';
                    style.outline  = '2px solid #8c8f94';
                    style.outlineOffset = '3px';
                } else if ( hasAnyFlag( attrs ) ) {
                    style.outline  = '2px solid #2271b1';
                    style.outlineOffset = '3px';
                }
                // Preview the per-device column order on the canvas.
                if ( canvasOrder !== null && canvasOrder >= 0 ) {
                    style.order = canvasOrder;
                }

                if ( ! Object.keys( style ).length ) {
                    return el( BlockListBlock, props );
                }

                var wrapperProps = Object.assign( {}, props.wrapperProps );
                wrapperProps.style = Object.assign( {}, wrapperProps.style, style );

                return el( BlockListBlock, Object.assign( {}, props, { wrapperProps: wrapperProps } ) );
            };
        }, 'withResponsiveIndicator' )
    );

    // ─── 3. Sidebar controls (editor.BlockEdit) ──────────────────────────────

    addFilter(
        'editor.BlockEdit',
        'flavor-block-visibility/with-responsive-controls',
        createHigherOrderComponent( function ( BlockEdit ) {
            return function ( props ) {
                var attrs         = props.attributes;
                var setAttributes = props.setAttributes;
                var device        = useDeviceType();

                var hideOnDesktop = attrs.flbvisHideOnDesktop;
                var hideOnTablet  = attrs.flbvisHideOnTablet;
                var hideOnMobile  = attrs.flbvisHideOnMobile;

                return el(
                    Fragment,
                    null,
                    el( BlockEdit, props ),
                    props.name === 'core/columns' && el( ColumnOrderSync, {
                        clientId:      props.clientId,
                        attributes:    attrs,
                        setAttributes: setAttributes,
                    } ),
                    props.name === 'core/columns' && props.isSelected && el( ColumnOrderPanel, {
                        clientId:      props.clientId,
                        attributes:    attrs,
                        setAttributes: setAttributes,
                        device:        device,
                    } ),
                    props.isSelected && el(
                        InspectorAdvancedControls,
                        null,
                        el(
                            'div',
                            { className: 'flbvis-responsive-conditions' },
                            el(
                                'h3',
                                { className: 'flbvis-responsive-conditions__title' },
                                el(
                                    'svg',
                                    {
                                        className: 'flbvis-responsive-conditions__icon',
                                        width: 16, height: 16,
                                        viewBox: '0 0 24 24',
                                        fill: 'none',
                                        xmlns: 'http://www.w3.org/2000/svg',
                                        'aria-hidden': 'true',
                                    },
                                    el( 'path', { d: 'M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V15C20 16.1046 19.1046 17 18 17H6C4.89543 17 4 16.1046 4 15V6Z', stroke: 'currentColor', strokeWidth: '1.5' } ),
                                    el( 'path', { d: 'M9 20H15', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' } ),
                                    el( 'path', { d: 'M12 17V20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' } )
                                ),
                                __( 'Responsive Conditions', 'flavor-block-visibility' )
                            ),
                            el( ToggleControl, {
                                label:    __( 'Hide on Desktop', 'flavor-block-visibility' ),
                                help:     hideOnDesktop ? __( 'Hidden on screens', 'flavor-block-visibility' ) + ' \u2265 ' + bp.desktop_min + 'px' : '',
                                checked:  !! hideOnDesktop,
                                onChange: function ( v ) { setAttributes( { flbvisHideOnDesktop: v } ); },
                            } ),
                            el( ToggleControl, {
                                label:    __( 'Hide on Tablet', 'flavor-block-visibility' ),
                                help:     hideOnTablet ? __( 'Hidden on screens', 'flavor-block-visibility' ) + ' ' + bp.tablet_min + 'px \u2013 ' + bp.tablet_max + 'px' : '',
                                checked:  !! hideOnTablet,
                                onChange: function ( v ) { setAttributes( { flbvisHideOnTablet: v } ); },
                            } ),
                            el( ToggleControl, {
                                label:    __( 'Hide on Mobile', 'flavor-block-visibility' ),
                                help:     hideOnMobile ? __( 'Hidden on screens', 'flavor-block-visibility' ) + ' \u2264 ' + bp.mobile_max + 'px' : '',
                                checked:  !! hideOnMobile,
                                onChange: function ( v ) { setAttributes( { flbvisHideOnMobile: v } ); },
                            } )
                        )
                    )
                );
            };
        }, 'withResponsiveControls' )
    );

    // ─── 4. Frontend: CSS classes on saved markup ─────────────────────────────
    // Same classes as the server-side render_block filter.

    addFilter(
        'blocks.getSaveContent.extraProps',
        'flavor-block-visibility/add-responsive-classes',
        function ( extraProps, blockType, attributes ) {
            var classes = [];
            if ( attributes.flbvisHideOnDesktop ) classes.push( 'flbvis-hide-desktop' );
            if ( attributes.flbvisHideOnTablet  ) classes.push( 'flbvis-hide-tablet'  );
            if ( attributes.flbvisHideOnMobile  ) classes.push( 'flbvis-hide-mobile'  );
            if ( classes.length ) {
                extraProps.className = ( extraProps.className || '' ) + ' ' + classes.join( ' ' );
            }
            return extraProps;
        }
    );

} )();
