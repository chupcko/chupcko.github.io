#!/usr/bin/sed -f

1{s|.*|find /sys/block -type l|e;s|/sys/block/||g;H;:l g;/^\n/!q
s|^\n\([a-z0-9]*\).*$|cat /sys/block/\1/uevent|e;/DEVTYPE=disk/!bn;g
s|^\n\([a-z0-9]*\).*$|cat /sys/block/\1/capability|e;/^50$/!bn;g
s|^\n\([a-z0-9]*\).*$|cat /sys/block/\1/removable|e;/^0$/!bn;g
s|^\n\([a-z0-9]*\).*$|cat /sys/block/\1/size|e;/^0$/bn;g
s|^\n\([a-z0-9]*\).*$|\1|;p;:n g;s|^\n[a-z0-9]*\(.*\)$|\1|;h;bl}
