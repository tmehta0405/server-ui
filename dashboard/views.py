from django.shortcuts import render, redirect
from .forms import SSHForm

def ssh(request):
    if request.method == 'POST':
        form = SSHForm(request.POST)
        if form.is_valid(): #need to change this functionality later
            return redirect('dashboard')
    else:
        form = SSHForm()

    return render(request, 'ssh.html', {'form': form})

def dashboard(request):
    return render(request, 'dashboard.html')
