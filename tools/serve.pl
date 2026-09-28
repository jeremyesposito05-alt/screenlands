#!/usr/bin/perl
# Petit serveur web local pour tester le jeu, sans Node ni Python :
#   perl tools/serve.pl [port]
# puis ouvrir http://localhost:8080. Il sert le dossier du dépôt en lecture
# seule et ne répond qu'à la machine locale.
use strict;
use warnings;
use IO::Socket::INET;
use File::Basename qw(dirname);
use File::Spec;

my $port = shift // 8080;
my $root = File::Spec->rel2abs(dirname(__FILE__) . "/..");
my %type = (
  html => "text/html; charset=utf-8", js => "text/javascript; charset=utf-8",
  css => "text/css; charset=utf-8", json => "application/json",
  webmanifest => "application/manifest+json", svg => "image/svg+xml",
  png => "image/png", jpg => "image/jpeg", webp => "image/webp",
  wav => "audio/wav", mp3 => "audio/mpeg", ogg => "audio/ogg",
);

my $server = IO::Socket::INET->new(
  LocalAddr => "127.0.0.1", LocalPort => $port, Listen => 16, ReuseAddr => 1,
) or die "Port $port indisponible : $!\n";
$| = 1;
print "Screenlands sur http://localhost:$port\n";

while (my $c = $server->accept) {
  my $line = <$c> // next;
  while (my $h = <$c>) { last if $h =~ /^\r?\n$/ }
  my ($path) = $line =~ m{^GET\s+(\S+)};
  $path //= "/";
  $path =~ s/[?#].*//;
  $path =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
  $path .= "index.html" if $path =~ m{/$};
  my $file = "$root$path";
  if ($path =~ /\.\./ || !-f $file) {
    print $c "HTTP/1.0 404 Not Found\r\nContent-Length: 0\r\n\r\n";
    print "404 $path\n";
  } else {
    my ($ext) = $file =~ /\.(\w+)$/;
    open my $f, "<:raw", $file;
    local $/; my $body = <$f>; close $f;
    print $c "HTTP/1.0 200 OK\r\nContent-Type: ", ($type{lc($ext // "")} // "application/octet-stream"),
      "\r\nContent-Length: ", length($body), "\r\nCache-Control: no-store\r\n\r\n", $body;
  }
  close $c;
}
