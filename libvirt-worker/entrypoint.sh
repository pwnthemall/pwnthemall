#!/bin/bash

set -e

ssh-keygen -A

mkdir -p /var/run/dbus
rm -f /var/run/dbus/pid
rm -f /var/run/dbus/dbus.pid
dbus-daemon --system --fork

echo "[+] Waiting for D-Bus..."
sleep 2
echo ""

echo "[+] Starting libvirtd..."
libvirtd --daemon

echo "[+] Waiting for libvirtd socket..."
for i in {1..30}; do
  if [ -S /var/run/libvirt/libvirt-sock ]; then
    echo "[✓] libvirtd socket ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[✗] libvirtd failed to start - socket not found"
    exit 1
  fi
  sleep 1
done
echo ""

if [ -S /var/run/libvirt/libvirt-sock ]; then
  chmod 660 /var/run/libvirt/libvirt-sock
  chown root:libvirt /var/run/libvirt/libvirt-sock
  echo "[✓] Socket permissions configured:"
  ls -l /var/run/libvirt/libvirt-sock
else
  echo "[✗] Socket not found"
  exit 1
fi
echo ""

echo "[+] Testing libvirt connection..."
if virsh -c qemu:///system version >/dev/null 2>&1; then
  echo "[✓] libvirt connection successful"
  virsh -c qemu:///system version
else
  echo "[⚠] libvirt connection test failed (non-blocking)"
fi
echo ""

echo "[+] Libvirt Worker Information:"
echo "  User: libvirt-user"
echo "  Groups: $(groups libvirt-user)"
echo "  Socket: /var/run/libvirt/libvirt-sock"
echo "  Images: /var/lib/libvirt/images"
echo ""

echo "[+] Starting virtlogd"
if virtlogd -d; then
  echo "[✓] Virtlogd started"
else
  echo "[⚠] Couldn't start virtlogd"
fi

echo "[✓] Libvirt Worker ready - SSH listening on port 22"
echo ""

exec /usr/sbin/sshd -D -e "$@"
