V 0.5 - demo has proven to be insanely buggy and will be replaced soon.


# I am aware that V 0.6 is just blatant broken and that the key shop isn't working, please wait for me to make a patch.
It is due to a bug in the script where gameState was never set to 'menu' after loading, and the starter pistol was intended to have a sprite, but since the code didn't detect one, it just failed and hanged. I'm implementing a patch. I seemed to overlook parts of the script while rewriting it completely to optimize the code.

