from django.shortcuts import render, redirect
from .forms import SSHForm
import paramiko
from paramiko.ssh_exception import SSHException, AuthenticationException
import socket


def ssh(request):
    ssh_info = None
    if request.method == 'POST':
        form = SSHForm(request.POST)
        if form.is_valid():
            hostname = form.cleaned_data['hostname']
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            port = form.cleaned_data.get('port') or 22

            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                client.connect(hostname, port=port, username=username, password=password, timeout=5)
                ssh_info = {
                    'hostname': hostname,
                    'username': username,
                    'port': port,
                }
                request.session['ssh_info'] = ssh_info
                return redirect('dashboard')
            except AuthenticationException:
                form.add_error(None, 'Authentication failed. Check username/password.')
            except (SSHException, socket.timeout, socket.error) as e:
                form.add_error(None, f'SSH connection failed: {e}')
            finally:
                try:
                    client.close()
                except Exception:
                    pass
    else:
        form = SSHForm()

    return render(request, 'ssh.html', {'form': form, 'ssh_info': ssh_info})


def dashboard(request):
    context = {
        'ssh_info': request.session.pop('ssh_info', None)
    }
    return render(request, 'dashboard.html', context)
