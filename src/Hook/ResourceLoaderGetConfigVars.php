<?php

namespace VEPageTemplates\Hook;

class ResourceLoaderGetConfigVars {
    public static function callback( &$vars, string $skin ) {
        global $wgVEPageTemplatesExcludedNamespaces;

        $vars[ 'wgVEPageTemplates' ] = [
            'excludedNamespaces' => $wgVEPageTemplatesExcludedNamespaces
        ];

        return true;
    }
}