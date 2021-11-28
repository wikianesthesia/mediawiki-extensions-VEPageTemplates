// TODO <references /> existing in a page template makes visual editor crash only if in visual mode

(function () {
    var vePageTemplatesConfig =  mw.config.get( 'wgVEPageTemplates' );

    if( Array.isArray( vePageTemplatesConfig.VEPageTemplatesExcludedNamespaces )
        && vePageTemplatesConfig.VEPageTemplatesExcludedNamespaces.indexOf( mw.config.get( 'wgNamespaceNumber' ) ) !== -1 ) {
        return;
    }

    ve.ui.pageTemplates = {};
    ve.ui.pageTemplates.commands = {};
    ve.ui.pageTemplates.tools = {};
    ve.ui.pageTemplates.templateData = {};

    ve.ui.pageTemplates.applyPageTemplate = function( pageTemplateTitle ) {
        var surface = ve.init.target.getSurface();
        var surfaceModel = surface.getModel();
        var documentModel = surfaceModel.getDocument();
        var range = documentModel.getDocumentNode().getOuterRange();

        if( !ve.ui.pageTemplates.templateData.hasOwnProperty( pageTemplateTitle ) ) {
            return;
        }

        var txReplacement = null;

        if( surface.getMode() === 'visual' ) {
            if( !ve.ui.pageTemplates.templateData[ pageTemplateTitle ].hasOwnProperty( 'parsoidData' ) ||
                !ve.ui.pageTemplates.templateData[ pageTemplateTitle ].parsoidData.hasOwnProperty( 'oldid' ) ||
                ve.ui.pageTemplates.templateData[ pageTemplateTitle ].parsoidData.oldid == 0 ) {
                OO.ui.alert( mw.message( 'vepagetemplates-couldnotloadpagetemplate',
                    ve.ui.pageTemplates.templateData[ pageTemplateTitle ].displayTitle
                ).text() );

                return;
            }

            var html = ve.ui.pageTemplates.templateData[ pageTemplateTitle ].parsoidData.content;
            var dom = ve.parseXhtml( html );

            mw.libs.ve.unwrapParsoidSections( dom.body );

            var data = ve.dm.converter.getModelFromDom( dom ).data.data;

            // TODO fix this hack to strip out erroneous "internallist" which I think causes javascript errors about canHaveChildrenNotContent not being defined
            data = data.slice( 0, data.length - 2 );

            txReplacement = ve.dm.TransactionBuilder.static.newFromReplacement(
                documentModel,
                range,
                data,
                true
            );
        } else if( surface.getMode() === 'source' ) {
            if( !ve.ui.pageTemplates.templateData[ pageTemplateTitle ].hasOwnProperty( 'wikitextData' ) ||
                !ve.ui.pageTemplates.templateData[ pageTemplateTitle ].wikitextData.hasOwnProperty( 'oldid' ) ||
                ve.ui.pageTemplates.templateData[ pageTemplateTitle ].wikitextData.oldid == 0 ) {
                OO.ui.alert( mw.message( 'vepagetemplates-couldnotloadpagetemplate',
                    ve.ui.pageTemplates.templateData[ pageTemplateTitle ].displayTitle
                ).text() );

                return;
            }

            txReplacement = ve.dm.TransactionBuilder.static.newFromReplacement(
                documentModel,
                range,
                ve.ui.pageTemplates.templateData[ pageTemplateTitle ].wikitextData.content,
                true
            );
        }

        range = txReplacement.translateRange( range );

        surfaceModel.change( txReplacement, new ve.dm.LinearSelection( range ) );

        surfaceModel.setLinearSelection( new ve.Range( 0, 0 ) );
    };

    // Create the loading dialog class
    ve.ui.pageTemplates.loadingDialog = function VeUiPageTemplateLoadingDialog( config ) {
        ve.ui.pageTemplates.loadingDialog.parent.call( this, config );
    };

    OO.inheritClass( ve.ui.pageTemplates.loadingDialog, OO.ui.Dialog );

    ve.ui.pageTemplates.loadingDialog.static.name = 'Loading';
    ve.ui.pageTemplates.loadingDialog.prototype.initialize = function() {
        ve.ui.pageTemplates.loadingDialog.super.prototype.initialize.call( this );
        this.content = new OO.ui.PanelLayout( { padded: true, expanded: false } );
        this.content.$element.append( mw.message( 'vepagetemplates-loadingpagetemplate' ).text() );
        this.$body.append( this.content.$element );
    };

    var veCommandToolNames = [];
    var reNewLine = /\r?\n/;
    var rePageTemplatesSectionLine = /^\s*==\s*(.*)\s*==\s*$/;
    var rePageTemplatesLine = /^\s*\*\s*(.*)\|(.*)\s*$/;

    var vePageTemplatesMsg = mw.message( 'vepagetemplatelist' ).text();

    if( !vePageTemplatesMsg.length ) {
        console.warn( mw.message( 'vepagetemplates' ).text() + ': ' + mw.message( 'vepagetemplates-couldnotloadpagetemplatelist' ).text() );

        return;
    }

    var vePageTemplatesLines = vePageTemplatesMsg.split( reNewLine );

    var reResult = null;

    for( var iLine in vePageTemplatesLines ) {
        let displayTitle = '';
        let templatePageTitle = '';

        let commandToolName = '';

        if( vePageTemplatesLines[ iLine ].search( rePageTemplatesLine ) !== -1 ) {
            reResult = vePageTemplatesLines[ iLine ].match( rePageTemplatesLine );

            displayTitle = reResult[ 1 ].trim();
            templatePageTitle = reResult[ 2 ].trim().replace( / /g, '_' );

            if( displayTitle && templatePageTitle ) {
                ve.ui.pageTemplates.templateData[ templatePageTitle ] = {
                    displayTitle: displayTitle,
                    varName: templatePageTitle.replace( /\W/g, '' )
                };

                // Define the variable name to be used for the VisualEditor Command and Tool
                commandToolName = 'pageTemplate' + ve.ui.pageTemplates.templateData[ templatePageTitle ].varName;

                // Allocate the command property
                ve.ui.pageTemplates.commands[ templatePageTitle ] = {};

                // Create the command class
                ve.ui.pageTemplates.commands[ templatePageTitle ].Command = function VeUiPageTemplateCommand( ) {
                    ve.ui.pageTemplates.commands[ templatePageTitle ].Command.parent.call( this, commandToolName );
                };

                OO.inheritClass( ve.ui.pageTemplates.commands[ templatePageTitle ].Command, ve.ui.Command );

                // Create command function
                ve.ui.pageTemplates.commands[ templatePageTitle ].Command.prototype.execute = function( surface ) {
                    // If the editor currently contains content, confirm before applying template
                    if( surface.getModel().getDocument().data.getText() != '' ) {
                        // TODO convert to Visual Editor dialog
                        if( !confirm( mw.message( 'vepagetemplates-pagenotempty', ve.ui.pageTemplates.templateData[ templatePageTitle ].displayTitle ).text() ) ) {
                            return;
                        }
                    }

                    // Set up the loading dialog in case we need it
                    var loadingDialog = new ve.ui.pageTemplates.loadingDialog( {} );
                    var windowManager = new OO.ui.WindowManager();
                    $( document.body ).append( windowManager.$element );
                    windowManager.addWindows( [ loadingDialog ] );

                    // TODO decide what to do if the parsoid data isn't loaded yet.
                    if( surface.getMode() === 'visual' ) {
                        if( !ve.ui.pageTemplates.templateData[ templatePageTitle ].hasOwnProperty( 'parsoidData' ) ) {

                            windowManager.openWindow( loadingDialog );
                            mw.libs.ve.targetLoader.requestParsoidData( templatePageTitle, {} ).then( function( response ) {
                                windowManager.closeWindow( loadingDialog );

                                ve.ui.pageTemplates.templateData[ templatePageTitle ].parsoidData = response.visualeditor;

                                ve.ui.pageTemplates.applyPageTemplate( templatePageTitle );
                            } ).fail( function( code, result ) {
                                console.warn( result.error.info );
                            } );
                        } else {
                            ve.ui.pageTemplates.applyPageTemplate( templatePageTitle );
                        }
                    } else if( surface.getMode() === 'source' ) {
                        if( !ve.ui.pageTemplates.templateData[ templatePageTitle ].hasOwnProperty( 'wikitextData' ) ) {
                            windowManager.openWindow( loadingDialog );

                            mw.libs.ve.targetLoader.requestWikitext( templatePageTitle, {} ).then( function( response ) {
                                windowManager.closeWindow( loadingDialog );

                                ve.ui.pageTemplates.templateData[ templatePageTitle ].wikitextData = response.visualeditor;

                                ve.ui.pageTemplates.applyPageTemplate( templatePageTitle );
                            } ).fail( function( code, result ) {
                                console.warn( result.error.info );
                            } );
                        } else {
                            ve.ui.pageTemplates.applyPageTemplate( templatePageTitle );
                        }
                    }
                };

            }
        } else if( vePageTemplatesLines[ iLine ].search( rePageTemplatesSectionLine ) !== -1 ) {
            reResult = vePageTemplatesLines[ iLine ].match( rePageTemplatesSectionLine );

            displayTitle = '*' + reResult[ 1 ].trim();

            if( sectionTitle ) {
                // TODO
            }
        }

        ve.ui.commandRegistry.register( new ve.ui.pageTemplates.commands[ templatePageTitle ].Command( ) );

        veCommandToolNames.push( commandToolName );

        // Allocate the tool property
        ve.ui.pageTemplates.tools[ templatePageTitle ] = {};

        // Create tool class
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool = function VeUiPageTemplateTool( ) {
            ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.super.apply( this, arguments );

            this.setDisabled( false );
        };

        OO.inheritClass( ve.ui.pageTemplates.tools[ templatePageTitle ].Tool, ve.ui.Tool );

        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.name = commandToolName;
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.group = 'pageTemplates';
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.title = displayTitle;
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.commandName = commandToolName;
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.autoAddToGroup = true;
        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.static.autoAddToCatchall = false;

        ve.ui.pageTemplates.tools[ templatePageTitle ].Tool.prototype.onUpdateState = function () {
            this.setActive( false );
        };

        ve.ui.toolFactory.register( ve.ui.pageTemplates.tools[ templatePageTitle ].Tool );
    }

    // Add dropdown to Visual Editor toolbar
    ve.init.mw.Target.static.toolbarGroups.push( {
        name: 'pageTemplates',
        header: OO.ui.deferMsg( 'vepagetemplates-pagetemplates' ),
        type: 'list',
        icon: 'articles',
        indicator: 'down',
        label: '',
        title: OO.ui.deferMsg( 'vepagetemplates-pagetemplates' ),
        include: veCommandToolNames
    } );

    // Prevent the page template menu from appearing on subeditors
    // subeditors uses ResourceModules as keys and the dialog property name in the ve.ui structure as values
    let subeditors = {
        'ext.visualEditor.mwgallery': 'MWGalleryDialog',
        'ext.visualEditor.mwlanguage': 'MWLanguageVariantInspector',
        'ext.visualEditor.mwimage': 'MWMediaDialog',
        'ext.cite.visualEditor': 'MWReferenceDialog'
    };

    for( let resourceModule in subeditors ) {
        let propertyName = subeditors[ resourceModule ];

        mw.loader.using( [
            resourceModule
        ] ).then( function () {
            if(
                ve.ui.hasOwnProperty( propertyName ) &&
                ve.ui[ propertyName ].hasOwnProperty( 'static' ) &&
                ve.ui[ propertyName ].static.hasOwnProperty( 'excludeCommands' )
            ) {
                for( let iCommand in veCommandToolNames ) {
                    ve.ui[ propertyName ].static.excludeCommands.push( veCommandToolNames[ iCommand ] );
                }
            }
        } );
    }
})();