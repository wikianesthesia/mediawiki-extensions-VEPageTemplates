<?php

namespace VEPageTemplates\Hook;

use OutputPage;
use Skin;

class BeforePageDisplay {
    public static function callback( OutputPage &$out, Skin &$skin ) {
        $out->addModules( 'ext.vePageTemplates' );
    }
}
