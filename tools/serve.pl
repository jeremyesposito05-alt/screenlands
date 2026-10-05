#!/usr/bin/perl
# Petit serveur web local pour tester le jeu, sans Node ni Python :
#   perl tools/serve.pl [port]
# puis ouvrir http://localhost:8080. Il sert le dossier du dépôt en lecture
# seule et ne répond qu'à la machine locale.
#
# Il surveille toutes ses connexions à la fois (IO::Select) : un navigateur
# ouvre souvent des connexions d'avance qu'il n'utilise pas, et un serveur
# qui attendrait sur l'une d'elles bloquerait toutes les autres. Une
# connexion restée muette plus de TIMEOUT secondes est fermée.
use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;
use File::Basename qw(dirname);
use File::Spec;

my $port = shift // 8080;
my $root = File::Spec->rel2abs(dirname(__FILE__) . "/..");
my $TIMEOUT = 5;
my %type = (
  html => "text/html; charset=utf-8", js => "text/javascript; charset=utf-8",
  css => "text/css; charset=utf-8", json => "application/json",
  webmanifest => "application/manifest+json", svg => "image/svg+xml",
  png => "image/png", jpg => "image/jpeg", webp => "image/webp",
  wav => "audio/wav", mp3 => "audio/mpeg", ogg => "audio/ogg",
);

my $server = IO::Socket::INET->new(
  LocalAddr => "127.0.0.1", LocalPort => $port, Listen => 128, ReuseAddr => 1,
) or die "Port $port indisponible : $!\n";
$| = 1;
# Un navigateur qui ferme une connexion en cours de réponse ne doit pas tuer
# le serveur.
$SIG{PIPE} = "IGNORE";
print "Screenlands sur http://localhost:$port\n";

my $sel = IO::Select->new($server);
# Par connexion : ce qu'on a reçu de la requête, et depuis quand elle attend.
my (%buf, %since);

sub drop {
  my $c = shift;
  $sel->remove($c);
  delete $buf{$c};
  delete $since{$c};
  close $c;
}

sub answer {
  my ($c, $request) = @_;
  # Le convertisseur (tools/pixelizer.html) enregistre ses sprites par PUT,
  # dans assets/sprites et nulle part ailleurs.
  if ($request =~ m{^PUT\s+(/assets/sprites/[\w-]+\.png)\s}) {
    my $path = $1;
    $request =~ /\r?\n\r?\n/;
    my $body = substr($request, $+[0]);
    mkdir "$root/assets/sprites";
    open my $out, ">:raw", "$root$path" or return;
    print $out $body;
    close $out;
    print $c "HTTP/1.0 204 No Content\r\nContent-Length: 0\r\n\r\n";
    print "PUT $path (", length($body), " octets)\n";
    return;
  }
  my ($path) = $request =~ m{^GET\s+(\S+)};
  $path //= "/";
  $path =~ s/[?#].*//;
  $path =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
  $path .= "index.html" if $path =~ m{/$};
  my $file = "$root$path";
  if ($path =~ /\.\./ || !-f $file) {
    print $c "HTTP/1.0 404 Not Found\r\nContent-Length: 0\r\n\r\n";
    print "404 $path\n";
    return;
  }
  my ($ext) = $file =~ /\.(\w+)$/;
  open my $f, "<:raw", $file or return;
  local $/;
  my $body = <$f>;
  close $f;
  print $c "HTTP/1.0 200 OK\r\nContent-Type: ", ($type{lc($ext // "")} // "application/octet-stream"),
    "\r\nContent-Length: ", length($body), "\r\nCache-Control: no-store\r\n\r\n", $body;
}

while (1) {
  for my $fh ($sel->can_read(1)) {
    if ($fh == $server) {
      my $c = $server->accept or next;
      binmode $c;
      $sel->add($c);
      $buf{$c} = "";
      $since{$c} = time;
      next;
    }
    my $n = sysread($fh, my $chunk, 8192);
    if (!$n) {
      drop($fh);
      next;
    }
    $buf{$fh} .= $chunk;
    # La requête est complète quand ses en-têtes le sont.
    # Un PUT attend en plus son corps, de la longueur annoncée.
    if ($buf{$fh} =~ /\r?\n\r?\n/) {
      my $head = $+[0];
      my ($len) = $buf{$fh} =~ /^Content-Length:\s*(\d+)/mi;
      next if $buf{$fh} =~ /^PUT/ && length($buf{$fh}) - $head < ($len // 0);
      answer($fh, $buf{$fh});
      drop($fh);
    }
  }
  my $now = time;
  for my $c (grep { $_ != $server } $sel->handles) {
    drop($c) if $now - $since{$c} > $TIMEOUT;
  }
}
