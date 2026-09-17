/******************************************************************************\
# dynamic_cursor                                 #       Maximum Tension       #
################################################################################
#                                                #      -__            __-     #
# Teoman Deniz                                   #  :    :!1!-_    _-!1!:    : #
# maximum-tension.com                            #  ::                      :: #
#                                                #  :!:    : :: : :  :  ::::!: #
# +.....................++.....................+ #   :!:: :!:!1:!:!::1:::!!!:  #
# : C - Maximum Tension :: Create - 2026/09/17 : #   ::!::!!1001010!:!11!!::   #
# :---------------------::---------------------: #   :!1!!11000000000011!!:    #
# : License - MIT       :: Update - 2026/09/17 : #    ::::!!!1!!1!!!1!!!::     #
# +.....................++.....................+ #       ::::!::!:::!::::      #
\******************************************************************************/

/*
** ES module entry.
**
**   import dynamic_cursor from "./dynamic_cursor.mjs";
**   dynamic_cursor.start({cursors: { ... }});
*/

import "./dynamic_cursor.js";

const	dynamic_cursor = globalThis.dynamic_cursor;

export const	start = dynamic_cursor.start;
export const	stop = dynamic_cursor.stop;
export const	swing_presets = dynamic_cursor.swing_presets;
export default	dynamic_cursor;
