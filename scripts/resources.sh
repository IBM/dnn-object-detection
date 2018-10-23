# Copyright [2018] IBM Corp. All Rights Reserved.
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

#!/bin/bash

# This script contains functions used by many of the scripts found in scripts/
# and tests/.

test_failed(){
    echo -e >&2 "\033[0;31m$1 test failed!\033[0m"
    exit 1
}

test_passed(){
    echo -e "\033[0;32m$1 test passed!\033[0m"
}

is_pull_request(){
  if [[ "$TRAVIS_PULL_REQUEST" != "false" ]]; then
      echo -e "\033[0;33mPull Request detected; not running $1!\033[0m"
      exit 0
  fi
}
