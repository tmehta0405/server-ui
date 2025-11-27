from django import forms

class SSHForm(forms.Form):
    hostname = forms.CharField(label='Hostname')
    username = forms.CharField(label='Username')
    password = forms.CharField(label='Password', widget=forms.PasswordInput)
    port = forms.IntegerField(label='Port', initial=22)