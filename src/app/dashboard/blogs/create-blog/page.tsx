'use client';

import { useEffect, useState, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from 'react-beautiful-dnd';
import Image from 'next/image';
// import Link from 'next/link';

/** ---------- Config ---------- */
const apiUrl =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'http://localhost:8001';

/** ---------- Types ---------- */
type ContentBlock =
  | {
      type: 'heading';
      level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      text: string;
    }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; style: 'ul' | 'ol'; items: string[] };

/** ---------- Outer page (wraps editor in Suspense) ---------- */
export default function AddNewBlogsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading blog editor…</div>}>
      <InnerBlogEditor />
    </Suspense>
  );
}

/** ---------- Inner component (safe to use useSearchParams here) ---------- */
function InnerBlogEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const blogId = searchParams?.get('id') ?? null;
  const isEdit = Boolean(blogId);

  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [contentGroups, setContentGroups] = useState<ContentBlock[][]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Record<number, string>>(
    {}
  );

  // Prefill when editing
  useEffect(() => {
    if (!isEdit || !blogId) return;
    (async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/blogs/${blogId}`);
        const { title, metaDescription, tags, contentBlocks, coverImage } =
          res.data || {};

        setTitle(title || '');
        setMetaDescription(metaDescription || '');
        setTags(Array.isArray(tags) ? tags.join(', ') : tags || '');

        if (Array.isArray(contentBlocks)) {
          const grouped = Array.isArray(contentBlocks[0])
            ? (contentBlocks as ContentBlock[][])
            : (contentBlocks as ContentBlock[]).map(b => [b]);
          setContentGroups(grouped);
        } else {
          setContentGroups([]);
        }

        if (coverImage) setPreviewImage(coverImage);
      } catch (e) {
        console.error('Failed to load blog:', e);
      }
    })();
  }, [isEdit, blogId]);

  /** ---------- Form actions ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', title);
    formData.append('metaDescription', metaDescription);
    formData.append('tags', tags);
    formData.append('contentBlocks', JSON.stringify(contentGroups));
    if (coverImage) formData.append('coverImage', coverImage);

    try {
      const url = isEdit
        ? `${apiUrl}/api/blogs/update/${blogId}`
        : `${apiUrl}/api/blogs/create`;
      const method = isEdit ? axios.put : axios.post;

      await method(url, formData);
      router.push('/dashboard/blogs');
    } catch (error) {
      console.error('Blog save error:', error);
    }
  };

  /** ---------- Blocks helpers ---------- */
  const addGroup = () => setContentGroups(prev => [...prev, []]);

  const removeGroup = (groupIdx: number) =>
    setContentGroups(prev => prev.filter((_, i) => i !== groupIdx));

  const addBlockToGroup = (groupIdx: number, block: ContentBlock) => {
    setContentGroups(prev => {
      const updated = [...prev];
      updated[groupIdx] = [...updated[groupIdx], block];
      return updated;
    });
  };

  const updateBlock = (
    groupIdx: number,
    blockIdx: number,
    updatedBlock: ContentBlock
  ) => {
    setContentGroups(prev => {
      const updated = [...prev];
      const group = [...updated[groupIdx]];
      group[blockIdx] = updatedBlock;
      updated[groupIdx] = group;
      return updated;
    });
  };

  const duplicateBlock = (groupIdx: number, blockIdx: number) => {
    setContentGroups(prev => {
      const updated = [...prev];
      const group = [...updated[groupIdx]];
      group.splice(blockIdx + 1, 0, { ...group[blockIdx] });
      updated[groupIdx] = group;
      return updated;
    });
  };

  const removeBlock = (groupIdx: number, blockIdx: number) => {
    setContentGroups(prev => {
      const updated = [...prev];
      const group = [...updated[groupIdx]];
      group.splice(blockIdx, 1);
      updated[groupIdx] = group;
      return updated;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sIdx = parseInt(source.droppableId, 10);
    const dIdx = parseInt(destination.droppableId, 10);

    setContentGroups(prev => {
      const newGroups = [...prev];
      const sourceGroup = [...newGroups[sIdx]];
      const [moved] = sourceGroup.splice(source.index, 1);
      const destGroup = [...newGroups[dIdx]];
      destGroup.splice(destination.index, 0, moved);
      newGroups[sIdx] = sourceGroup;
      newGroups[dIdx] = destGroup;
      return newGroups;
    });
  };

  /** ---------- UI ---------- */
    return (
      <>
        <div className="flex items-center flex-wrap justify-between gap20 mb-27">
          <h3></h3>
          <ul className="breadcrumbs flex items-center flex-wrap justify-start gap10">
            <li>
              <a href="index-2.html">
                <div className="text-tiny">Dashboard</div>
              </a>
            </li>
            <li>
              <i className="icon-chevron-right"></i>
            </li>
            <li>
              <a href="#">
                <div className="text-tiny">Blogs</div>
              </a>
            </li>
            <li>
              <i className="icon-chevron-right"></i>
            </li>
            <li>
              <div className="text-tiny">Create Blogs</div>
            </li>
          </ul>
        </div>

        {/* <!-- product-list --> */}
        <div className="wg-box">
          <div className="create-blogs-wrapper">
            <div className="p-6 max-w-5xl mx-auto">
              <h1 className="!text-[34px] !leading-[1.2] font-semibold !mb-6">
                {isEdit ? 'Edit Blog' : 'Create Blog'}
              </h1>
              <form onSubmit={handleSubmit} className="space-y-6">
                <input
                  type="text"
                  placeholder="Blog Title"
                  className="w-full input-blog-title border !px-4 !py-2"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
                <textarea
                  placeholder="Meta Description"
                  className="w-full border input-blog-description px-4 py-2"
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  className="w-full input-blog-tag border px-4 py-2"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                />
                {previewImage && !coverImage && (
                  <Image
                    src={previewImage}
                    alt="Preview"
                    className="w-40 mb-2 rounded"
                    width={160}
                    height={120}
                  />
                )}
                <div className="col-12 !mt-6 !mb-12">
                  <div className="wg-box  !max-w-md !gap-2 !p-0">
                    <h6 className="!leading-[1.2] !mb-2">Add image</h6>
                    <div className="row ">
                      <div className="col-12">
                        <div className="upload-image ">
                          <div className="item up-load !min-h-[110px]">
                            <label className="uploadfile" htmlFor="myFile">
                              <span className="icon">
                                <i className="icon-upload-cloud"></i>
                              </span>
                              <span className="text-tiny">
                                Drop your images here or select{' '}
                                <span className="tf-color">click to browse</span>
                              </span>
                              <input
                                type="file"
                                id="myFile"
                                accept="image/*"
                                onChange={e =>
                                  setCoverImage(e.target.files?.[0] || null)
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-lg font-bold mb-24">Content Block Groups</h4>

                <DragDropContext onDragEnd={handleDragEnd}>
                  {contentGroups.map((group, groupIdx) => (
                    <div
                      key={groupIdx}
                      className="border p-4 rounded bg-gray-50 mb-6"
                    >
                      <div className="flex justify-between !items-start !mb-5">
                        <h6 className="font-semibold">Group {groupIdx + 1}</h6>
                        <button
                          type="button"
                          className="!text-red-500 !text-[12px] !leading-[1.2] !py-3 !px-4 !rounded-[4px]"
                          onClick={() => removeGroup(groupIdx)}
                        >
                          ✕
                        </button>
                      </div>

                      <Droppable droppableId={String(groupIdx)}>
                        {provided => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {group.map((block, blockIdx) => (
                              <Draggable
                                key={blockIdx}
                                draggableId={`${groupIdx}-${blockIdx}`}
                                index={blockIdx}
                              >
                                {drag => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    {...drag.dragHandleProps}
                                    className="border p-3 !rounded-[4px] bg-white !mb-5 relative"
                                  >
                                    <div className="relative !justify-end !mb-2 ml-auto flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          duplicateBlock(groupIdx, blockIdx)
                                        }
                                        className="text-blue-600 !text-[12px] !leading-[1.2] !py-3 !px-4 !rounded-[4px]"
                                      >
                                        ⧉
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeBlock(groupIdx, blockIdx)
                                        }
                                        className="!text-red-500 !text-[12px] !leading-[1.2] !py-3 !px-4 !rounded-[4px]"
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    {/* Block UI */}
                                    {block.type === 'heading' && (
                                      <>
                                        <select
                                          value={block.level}
                                          onChange={e =>
                                                updateBlock(groupIdx, blockIdx, {
                                                  ...block,
                                                  level: e.target.value as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
                                                })
                                              }
                                          className="border !px-3 !py-3 !rounded-[4px] !mb-3"
                                        >
                                          {[
                                            'h1',
                                            'h2',
                                            'h3',
                                            'h4',
                                            'h5',
                                            'h6',
                                          ].map(h => (
                                            <option key={h} value={h}>
                                              {h.toUpperCase()}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          type="text"
                                          className="w-full border !rounded-[4px] !px-4 !py-3"
                                          placeholder="Heading text"
                                          value={block.text}
                                          onChange={e =>
                                            updateBlock(groupIdx, blockIdx, {
                                              ...block,
                                              text: e.target.value,
                                            })
                                          }
                                        />
                                      </>
                                    )}

                                    {block.type === 'paragraph' && (
                                      <textarea
                                        className="w-full border !rounded-[4px] !px-4 !py-3"
                                        placeholder="Paragraph text"
                                        value={block.text}
                                        onChange={e =>
                                          updateBlock(groupIdx, blockIdx, {
                                            ...block,
                                            text: e.target.value,
                                          })
                                        }
                                      />
                                    )}

                                    {block.type === 'list' && (
                                      <>
                                        <select
                                          value={block.style}
                                          onChange={e =>
                                            updateBlock(groupIdx, blockIdx, {
                                              ...block,
                                              style: e.target.value as
                                                | 'ul'
                                                | 'ol',
                                            })
                                          }
                                          className="border !rounded-[4px] !px-4 !py-3 !mb-3"
                                        >
                                          <option value="ul">
                                            Unordered List
                                          </option>
                                          <option value="ol">Ordered List</option>
                                        </select>
                                        {block.items.map((item, i) => (
                                          <input
                                            key={i}
                                            type="text"
                                            value={item}
                                            placeholder="Write lists item text"
                                            className="w-full border !rounded-[4px] !px-4 !py-3 !mb-4"
                                            onChange={e => {
                                              const items = [...block.items];
                                              items[i] = e.target.value;
                                              updateBlock(groupIdx, blockIdx, {
                                                ...block,
                                                items,
                                              });
                                            }}
                                          />
                                        ))}
                                        <button
                                          type="button"
                                          className="text-sm !px-6 !py-3 !rounded-[4px]"
                                          onClick={() =>
                                            updateBlock(groupIdx, blockIdx, {
                                              ...block,
                                              items: [...block.items, ''],
                                            })
                                          }
                                        >
                                          + Add List
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      <div className="flex items-center gap-4 mt-3">
                        <select
                          value={selectedTypes[groupIdx] || ''}
                          onChange={e =>
                            setSelectedTypes({
                              ...selectedTypes,
                              [groupIdx]: e.target.value,
                            })
                          }
                          className="border !rounded-[4px] !px-4 !py-3"
                        >
                          <option value="">Select Content Type</option>
                          <option value="heading">Heading</option>
                          <option value="paragraph">Paragraph</option>
                          <option value="list">List</option>
                        </select>
                        <button
                          type="button"
                          className="bg-gray-200 whitespace-nowrap !px-4 !py-3 !rounded-[4px] !w-full !max-w-[90px]"
                          onClick={() => {
                            const type = selectedTypes[groupIdx];
                            if (type === 'heading') {
                              addBlockToGroup(groupIdx, {
                                type: 'heading',
                                level: 'h2',
                                text: '',
                              });
                            } else if (type === 'paragraph') {
                              addBlockToGroup(groupIdx, {
                                type: 'paragraph',
                                text: '',
                              });
                            } else if (type === 'list') {
                              addBlockToGroup(groupIdx, {
                                type: 'list',
                                style: 'ul',
                                items: [''],
                              });
                            }
                            setSelectedTypes({
                              ...selectedTypes,
                              [groupIdx]: '',
                            });
                          }}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </DragDropContext>

                <button
                  type="button"
                  onClick={addGroup}
                  className="tf-button !h-16 !mt-6 rounded"
                >
                  Add Block Group
                </button>

                <button
                  type="submit"
                  className="tf-button px-6 py-2 rounded !mt-14"
                >
                  {isEdit ? 'Update Blog' : 'Create Blog'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
}
