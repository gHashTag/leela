#!/usr/bin/ruby
# Run the bitcode strip after the frameworks are embedded.
#
# Position is the whole point: the script edits framework binaries that the
# CocoaPods embed step has already copied and signed, so it must come after
# that step, and it re-signs what it touches. Placed before, it would find
# nothing to strip and the 458 MB would ship anyway.
#
# Idempotent: re-running replaces the phase rather than adding another.

require 'xcodeproj'

project = Xcodeproj::Project.open(File.join(__dir__, 'leela.xcodeproj'))
target = project.targets.find { |t| t.name == 'leela' }
abort 'target leela not found' unless target

NAME = 'Strip bitcode from embedded frameworks'

target.build_phases.select { |p| p.respond_to?(:name) && p.name == NAME }.each do |phase|
  target.build_phases.delete(phase)
end

phase = target.new_shell_script_build_phase(NAME)
phase.shell_script = '"$SRCROOT/strip_bitcode.sh"'
phase.show_env_vars_in_log = '0'

# Last, so every embed and sign step that could put a framework in place has
# already run.
target.build_phases.delete(phase)
target.build_phases << phase

project.save
puts "build phase '#{NAME}' added, last in target leela"
puts target.build_phases.map { |p| p.respond_to?(:name) ? p.name : p.class.name.split('::').last }.join(' | ')
