#cloud-config
# First-boot configuration for an Indent Easy environment VM (DEV, QA or PROD).
# Placeholders in {{double braces}} are filled by prepare-images.ps1.
hostname: {{HOSTNAME}}
fqdn: {{HOSTNAME}}.{{DOMAIN}}
prefer_fqdn_over_hostname: false
timezone: Asia/Kolkata
locale: en_IN.UTF-8

groups:
  - docker

users:
  - name: {{ADMIN_USER}}
    gecos: Indent Easy administrator
    groups: [sudo, docker]
    shell: /bin/bash
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    lock_passwd: true
    ssh_authorized_keys:
      - {{SSH_PUBLIC_KEY}}

ssh_pwauth: false
disable_root: true

# Small VMs on a shared laptop: a swap file keeps memory spikes from killing containers.
swap:
  filename: /swapfile
  size: 1G

package_update: true
package_upgrade: true
packages:
  - docker.io
  - docker-compose-v2
  - ufw
  - curl
  - jq
  - unattended-upgrades

write_files:
  - path: /etc/indent-easy/environment
    permissions: '0644'
    content: |
      IE_ENV={{ENV_NAME}}
      IE_HOSTNAME={{HOSTNAME}}.{{DOMAIN}}
  - path: /etc/docker/daemon.json
    permissions: '0644'
    content: |
      {
        "log-driver": "json-file",
        "log-opts": { "max-size": "10m", "max-file": "3" },
        "live-restore": true
      }

runcmd:
  - systemctl enable --now docker
  - install -d -m 0750 -o {{ADMIN_USER}} -g {{ADMIN_USER}} /opt/indent-easy
  - ufw default deny incoming
  - ufw allow OpenSSH
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
  - touch /var/lib/indent-easy-provisioned

final_message: 'Indent Easy {{ENV_NAME}} VM ready after $UPTIME seconds'
