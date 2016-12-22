final int PLANES_HALF = 3;

final int PLANES = PLANES_HALF*2;
final int DIMENSION = int(pow(2, PLANES_HALF));
final int SIZE = 20;

int plane;

void setup()
{
  size
  (
    SIZE+DIMENSION*SIZE+SIZE,
    SIZE+DIMENSION*SIZE+SIZE
  );
  smooth();
  noLoop();
  plane = 0;
}

void draw_box(int x, int y)
{
  fill(255);
  rect((x+1)*SIZE, (y+1)*SIZE, SIZE, SIZE);
}

void draw_fill_box(int x, int y)
{
  fill(128);
  rect((x+1)*SIZE, (y+1)*SIZE, SIZE, SIZE);
}

void draw()
{
  int x;
  int y;

  background(255);
  textSize(SIZE);
  fill(0);
  stroke(0);
  text(""+(plane+1), 0, SIZE);
  for(y = 0; y < DIMENSION; y++)
    for(x = 0; x < DIMENSION; x++)
      if(((y*DIMENSION+x)&(1<<plane)) != 0)
        draw_fill_box(x, y);
      else
        draw_box(x, y);
}

void keyTyped()
{
  if(key >= '1' && key <= '0'+PLANES)
  {
    background(0);
    plane = key-'1';
    redraw();
  }
}
