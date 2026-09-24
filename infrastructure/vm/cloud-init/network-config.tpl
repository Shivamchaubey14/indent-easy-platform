# Static address on the IE-Env internal switch; the host NATs it to the internet.
version: 2
ethernets:
  eth0:
    match:
      driver: hv_netvsc
    set-name: eth0
    dhcp4: false
    addresses: [{{IP}}/{{PREFIX_LENGTH}}]
    routes:
      - to: default
        via: {{GATEWAY}}
    nameservers:
      addresses: [{{DNS}}]
