#! /usr/bin/env ruby
require 'json'

data = ''
while STDIN.gets !~ /The machine triggered/ ; end
while (line = STDIN.gets) !~ /To run again:/
  data << line
end
puts eval(data).to_json
