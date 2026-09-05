* When a lookup table, like federal tax brackets is needed, then any other code that needs you use a
  value for a tax bracket must fetch the value from that one source-of-truth lookup table. Do not
  hard code, for example, a constant to a value like 108000 which happens to be the 12% tax bracket.
  That would result in 108000 being defined in two places for the same tax bracket. Apply this logic
  to any sort of look table this application required.
* Constants and variables should not be initialized to "magic number" values in places where the
  initialization value has a meaningful semantic meaning. For example, if an income amount slider
  should initialize to 100000, then define a CONST value with a meaningful name and set it to that
  value then initialize the slider using the CONST.