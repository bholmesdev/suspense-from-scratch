import bjorkPost from "./bjork-post.json" assert { type: "json" };
import ladyGagaTheFame from "./lady-gaga-the-fame.json" assert { type: "json" };
import glassAnimalsHowToBeAMHumanBeing from "./glass-animals-how-to-be.json" assert { type: "json" };

type Song = {
  title: string;
  duration: string;
};

type Album = {
  id: string;
  artist: string;
  title: string;
  cover: string;
  songs: Song[];
};

const albums = [
  bjorkPost,
  ladyGagaTheFame,
  glassAnimalsHowToBeAMHumanBeing,
] satisfies Album[];

export const artificialWait = (ms = 4000) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function getAll() {
  await artificialWait();
  return albums;
}

const idToWait = {
  "bjork-post": 3000,
  "lady-gaga-the-fame": 1000,
  "glass-animals-how-to-be": 2000,
};

export type AlbumId = keyof typeof idToWait;

export async function getById(id: AlbumId) {
  await artificialWait(idToWait[id]);

  const album = albums.find((album) => album.id === id);
  if (!album) throw new Error(`Album with id ${id} not found`);

  return album;
}
