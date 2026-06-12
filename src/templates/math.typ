#let answer-lines(count: 3) = {
  for i in range(count) {
    line(length: 100%)
    v(7mm)
  }
}

#let answer-box(height: 28mm) = rect(width: 100%, height: height, stroke: black + 0.7pt)
