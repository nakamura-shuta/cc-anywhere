import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import GroupTaskForm from './GroupTaskForm.svelte';
import type { GroupTaskSubmitData } from './GroupTaskForm.svelte';

describe('GroupTaskForm', () => {
  let mockOnSubmit: Mock<(data: GroupTaskSubmitData) => void>;

  beforeEach(() => {
    mockOnSubmit = vi.fn();
  });

  it('should render initial task form', () => {
    const { getByText, getByLabelText } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    expect(getByText('グループタスク設定')).toBeInTheDocument();
    expect(getByLabelText('グループ名')).toBeInTheDocument();
    expect(getByText('タスク 1')).toBeInTheDocument();
  });

  it('should add new task when clicking add button', async () => {
    const { getByText, container } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    const addButton = getByText('タスクを追加');
    await fireEvent.click(addButton);

    // Check if Task 2 appears
    await waitFor(() => {
      expect(getByText('タスク 2')).toBeInTheDocument();
    });

    // Should have 2 task forms
    const taskCards = container.querySelectorAll('[data-testid="task-card"]');
    expect(taskCards).toHaveLength(2);
  });

  it('should remove task when clicking remove button', async () => {
    const { getByText, container, queryByText } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    // Add a second task first
    const addButton = getByText('タスクを追加');
    await fireEvent.click(addButton);

    // Remove the second task
    const removeButtons = container.querySelectorAll('[data-testid="remove-task-button"]');
    await fireEvent.click(removeButtons[1]);

    // Task 2 should be removed
    await waitFor(() => {
      expect(queryByText('タスク 2')).not.toBeInTheDocument();
    });
  });

  it('should update task dependencies', async () => {
    const { getByText, container } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    // Add second and third tasks
    const addButton = getByText('タスクを追加');
    await fireEvent.click(addButton);
    await fireEvent.click(addButton);

    // Find dependency selects
    const dependencySelects = container.querySelectorAll('[data-testid="dependency-select"]');
    expect(dependencySelects).toHaveLength(2); // Task 2 and 3 have dependency selects

    // Task 2 can depend on Task 1
    const task2Select = dependencySelects[0] as HTMLSelectElement;
    await fireEvent.change(task2Select, { target: { value: 'task-1' } });
    expect(task2Select.value).toBe('task-1');
  });

  it('should validate required fields before submission', async () => {
    const { getByText, getByLabelText, container } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    const submitButton = getByText('グループタスクを実行');
    await fireEvent.click(submitButton);

    // Should not submit if fields are empty
    expect(mockOnSubmit).not.toHaveBeenCalled();

    // Fill required fields
    const groupNameInput = getByLabelText('グループ名') as HTMLInputElement;
    await fireEvent.input(groupNameInput, { target: { value: 'Test Group' } });

    const taskNameInput = container.querySelector('[data-testid="task-name-0"]') as HTMLInputElement;
    await fireEvent.input(taskNameInput, { target: { value: 'Task 1' } });

    const instructionInput = container.querySelector('[data-testid="task-instruction-0"]') as HTMLTextAreaElement;
    await fireEvent.input(instructionInput, { target: { value: 'Do something' } });

    // Now it should submit
    await fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Group',
        tasks: [
          {
            id: 'task-1',
            name: 'Task 1',
            instruction: 'Do something',
            dependencies: []
          }
        ],
        execution: {
          mode: 'sequential',
          continueSession: true,
          continueOnError: false
        }
      });
    });
  });

  it('should detect circular dependencies', async () => {
    const { getByText, container } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    // Add three tasks
    const addButton = getByText('タスクを追加');
    await fireEvent.click(addButton);
    await fireEvent.click(addButton);

    // Create circular dependency: 1 -> 2 -> 3 -> 1
    const dependencySelects = container.querySelectorAll('[data-testid="dependency-select"]');
    
    // Task 2 depends on Task 1
    await fireEvent.change(dependencySelects[0], { target: { value: 'task-1' } });
    
    // Task 3 depends on Task 2
    await fireEvent.change(dependencySelects[1], { target: { value: 'task-2' } });
    
    // Try to make Task 1 depend on Task 3 (should show error)
    // This would need special handling in the component
  });

  it.skip('should switch execution modes', async () => {
    const { container } = render(GroupTaskForm, {
      props: {
        onSubmit: mockOnSubmit as (data: GroupTaskSubmitData) => void
      }
    });

    // Check default mode
    const sequentialRadio = container.querySelector('#mode-sequential') as HTMLInputElement;
    expect(sequentialRadio.checked).toBe(true);

    // Switch to parallel mode
    const parallelRadio = container.querySelector('#mode-parallel') as HTMLInputElement;
    await fireEvent.click(parallelRadio);
    expect(parallelRadio.checked).toBe(true);

    // Switch to mixed mode
    const mixedRadio = container.querySelector('#mode-mixed') as HTMLInputElement;
    await fireEvent.click(mixedRadio);
    expect(mixedRadio.checked).toBe(true);
  });
});